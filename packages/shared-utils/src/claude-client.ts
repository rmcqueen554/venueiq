import Anthropic from '@anthropic-ai/sdk';
import { logger } from './logger';
import { publishEvent, KAFKA_TOPICS } from './kafka-client';

const MODEL = 'claude-sonnet-4-20250514';
const CACHE_TTL = 5 * 60; // 5-minute prompt cache TTL

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ClaudeCallOptions {
  tenant_id: string;
  service: string;
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  max_tokens?: number;
  temperature?: number;
  use_cache?: boolean;
}

export interface ClaudeResponse {
  content: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

// Approximate cost per token (claude-sonnet-4)
const INPUT_COST_PER_TOKEN = 3 / 1_000_000;   // $3 per 1M input tokens
const OUTPUT_COST_PER_TOKEN = 15 / 1_000_000;  // $15 per 1M output tokens

export async function callClaude(opts: ClaudeCallOptions): Promise<ClaudeResponse> {
  const startMs = Date.now();

  const systemBlock: Anthropic.Messages.TextBlockParam & { cache_control?: { type: 'ephemeral' } } = {
    type: 'text',
    text: opts.system,
    ...(opts.use_cache !== false ? { cache_control: { type: 'ephemeral' } } : {}),
  };

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: opts.max_tokens ?? 2048,
    temperature: opts.temperature ?? 0.3,
    system: [systemBlock] as Anthropic.Messages.TextBlockParam[],
    messages: opts.messages,
  });

  const content = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  const input_tokens = response.usage.input_tokens;
  const output_tokens = response.usage.output_tokens;
  const cost_usd = input_tokens * INPUT_COST_PER_TOKEN + output_tokens * OUTPUT_COST_PER_TOKEN;
  const latency_ms = Date.now() - startMs;

  // Log every call for cost tracking
  logger.info(
    { tenant_id: opts.tenant_id, service: opts.service, input_tokens, output_tokens, cost_usd, latency_ms },
    'Claude API call',
  );

  // Emit to Kafka for cost analytics
  await publishEvent(KAFKA_TOPICS.MODULE_KPI_SNAPSHOTS, opts.tenant_id, {
    schema_version: '1.0',
    tenant_id: opts.tenant_id,
    event_id: null,
    module: `claude_cost.${opts.service}`,
    kpis: { input_tokens, output_tokens, cost_usd, latency_ms, model: MODEL },
    snapshot_at: new Date().toISOString(),
  }).catch(() => {}); // non-blocking

  return { content, input_tokens, output_tokens, cost_usd };
}

// ── Streaming version for NLQ ─────────────────────────────────────────────
export async function* streamClaude(opts: ClaudeCallOptions): AsyncGenerator<string> {
  const systemBlock: Anthropic.Messages.TextBlockParam & { cache_control?: { type: 'ephemeral' } } = {
    type: 'text',
    text: opts.system,
    ...(opts.use_cache !== false ? { cache_control: { type: 'ephemeral' } } : {}),
  };

  const stream = await anthropic.messages.create({
    model: MODEL,
    max_tokens: opts.max_tokens ?? 2048,
    temperature: opts.temperature ?? 0.3,
    system: [systemBlock] as Anthropic.Messages.TextBlockParam[],
    messages: opts.messages,
    stream: true,
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text;
    }
  }
}
