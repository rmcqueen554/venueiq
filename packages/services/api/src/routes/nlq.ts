import { FastifyInstance } from 'fastify';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db';

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const SUGGESTED: Record<string, string[]> = {
  '/dashboard':    ['What are our top priorities right now?', 'What is our projected revenue for the next event?', 'Which departments need attention?'],
  '/concessions':  ['Why were concession sales down last night?', 'What inventory should we order for the next event?'],
  '/security':     ['What are the highest risk areas for tonight?', 'What incidents happened last event?'],
  '/sponsorship':  ['Which sponsors are underperforming?', 'Which contracts expire in the next 60 days?'],
  '/ticketing':    ['How is ticket sales velocity tracking?', 'Which season ticket accounts are at risk?'],
  'default':       ['What happened at last night\'s event?', 'What are our top 3 priorities right now?', 'What is our season-to-date revenue?'],
};

export async function nlqRoutes(app: FastifyInstance) {
  // SSE streaming NLQ endpoint
  app.post('/nlq/query', async (req, reply) => {
    const { question, session_id, context_page, tenant_id } = req.body as any;
    if (!question || !tenant_id) return reply.status(400).send({ success: false, error: { code: 'MISSING', message: 'question and tenant_id required' } });

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': process.env.FRONTEND_URL ?? '*',
    });

    const send = (data: Record<string, unknown>) => reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);

    try {
      if (!anthropic) {
        send({ type: 'token', content: 'AI advisor is not configured yet (ANTHROPIC_API_KEY not set). Please add your Anthropic API key to enable the AI Chat feature.' });
        send({ type: 'done' });
        reply.raw.end();
        return;
      }

      // Fetch relevant context from the database
      const [tenant, recentEvents, riskItems] = await Promise.all([
        db.tenant.findUnique({ where: { id: tenant_id }, select: { name: true, type: true, tier: true } }),
        db.event.findMany({ where: { tenant_id }, orderBy: { scheduled_at: 'desc' }, take: 5 }),
        db.riskOpportunity.findMany({ where: { tenant_id, dismissed: false }, take: 5 }),
      ]);

      const context = `Venue: ${tenant?.name} (${tenant?.type})
Recent events: ${recentEvents.map((e) => `${e.name} (${e.status})`).join(', ')}
Active risks: ${riskItems.map((r) => r.title).join(', ') || 'none'}`;

      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: `You are the AI advisor for ${tenant?.name ?? 'VenueIQ'}, a stadium operations intelligence platform.
Answer questions about venue operations concisely. If you don't have specific data, say so clearly — never fabricate numbers.
Context: ${context}`,
        messages: [{ role: 'user', content: question }],
      });

      let fullContent = '';
      let inputTokens = 0;
      let outputTokens = 0;

      stream.on('text', (text) => {
        fullContent += text;
        send({ type: 'token', content: text });
      });

      const final = await stream.finalMessage();
      inputTokens = final.usage.input_tokens;
      outputTokens = final.usage.output_tokens;

      send({ type: 'done' });
      reply.raw.end();

      // Log async
      await Promise.all([
        db.nlqQuery.create({
          data: { tenant_id, user_id: 'user', user_role: 'general_manager', question, response: fullContent, session_id: session_id ?? 'default', context_page },
        }).catch(() => {}),
        db.claudeApiCallLog.create({
          data: {
            tenant_id, service: 'nlq',
            model: 'claude-sonnet-4-20250514',
            input_tokens: inputTokens, output_tokens: outputTokens,
            cost_usd: (inputTokens * 3 + outputTokens * 15) / 1_000_000,
            latency_ms: 0,
          },
        }).catch(() => {}),
      ]);

    } catch (err: any) {
      send({ type: 'error', error: 'Query failed. Please try again.' });
      reply.raw.end();
    }
  });

  // Suggested questions
  app.get('/nlq/suggestions', async (req, reply) => {
    const { page } = req.query as any;
    return { success: true, data: SUGGESTED[page] ?? SUGGESTED['default'] };
  });
}
