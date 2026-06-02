import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { getSession, appendSession, cacheGet, cacheSet, createPrismaClient, logger } from '@venueiq/shared-utils';
import { sqlGeneratorService } from '../services/sql-generator.service';
import { redshiftService } from '../services/redshift.service';
import { answerGeneratorService } from '../services/answer-generator.service';

const prisma = createPrismaClient(process.env.NLQ_DATABASE_URL!);

export async function queryRoutes(app: FastifyInstance) {
  // POST /api/nlq/query — SSE streaming response
  app.post('/query', async (request, reply) => {
    const body = request.body as any;
    const { question, session_id, context_page } = body;

    // Get auth context
    const auth = (request as any).auth;
    const tenant_id = auth?.sessionClaims?.public_metadata?.tenant_id ?? body.tenant_id;
    const user_role = auth?.sessionClaims?.public_metadata?.role ?? 'event_manager';
    const user_id = auth?.userId ?? 'anonymous';

    if (!question || !session_id || !tenant_id) {
      return reply.status(400).send({ success: false, error: { code: 'MISSING_PARAMS', message: 'question, session_id, tenant_id required' } });
    }

    // Check cache (5-minute TTL for common questions)
    const questionHash = crypto.createHash('sha256').update(`${tenant_id}:${user_role}:${question}`).digest('hex');
    const cached = await cacheGet<string>(`nlq:cache:${questionHash}`);

    if (cached) {
      // Fast path: stream cached answer
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      reply.raw.write(`data: ${JSON.stringify({ type: 'token', content: cached, cached: true })}\n\n`);
      reply.raw.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      reply.raw.end();
      return;
    }

    // Set up SSE
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const sendEvent = (data: Record<string, unknown>) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      // 1. Get conversation history from Redis
      const history = await getSession(session_id);

      // 2. Generate SQL
      const { sql, explanation, error: sqlError } = await sqlGeneratorService.generateSql(
        tenant_id,
        user_role,
        question,
        history,
      );

      if (sqlError || !sql) {
        sendEvent({ type: 'token', content: `I don't have the data to answer that question. ${explanation}` });
        sendEvent({ type: 'done' });
        reply.raw.end();
        return;
      }

      sendEvent({ type: 'sql', sql, explanation });

      // 3. Execute query against Redshift
      const { rows, duration_ms } = await redshiftService.executeQuery(sql, tenant_id);
      sendEvent({ type: 'data', row_count: rows.length, duration_ms });

      // 4. Stream answer from Claude
      let fullAnswer = '';
      for await (const chunk of answerGeneratorService.generateStreamingAnswer(tenant_id, question, rows, explanation)) {
        fullAnswer += chunk;
        sendEvent({ type: 'token', content: chunk });
      }

      sendEvent({ type: 'done', query_id: questionHash });
      reply.raw.end();

      // 5. Update conversation session
      await appendSession(session_id, 'user', question);
      await appendSession(session_id, 'assistant', fullAnswer);

      // 6. Cache the answer
      await cacheSet(`nlq:cache:${questionHash}`, fullAnswer, 300);

      // 7. Log query to DB (async)
      await prisma.nlqQuery.create({
        data: {
          tenant_id,
          user_id,
          user_role,
          question,
          generated_sql: sql,
          execution_time_ms: duration_ms,
          rows_returned: rows.length,
          response: fullAnswer,
          session_id,
          context_page: context_page ?? null,
          cached: false,
        },
      }).catch(() => {}); // non-blocking

    } catch (err: any) {
      logger.error({ err, tenant_id }, 'NLQ query failed');
      sendEvent({ type: 'error', error: 'Query failed. Please try rephrasing your question.' });
      reply.raw.end();
    }
  });

  // GET suggested questions for a given page
  app.get('/suggestions', async (request, reply) => {
    const { page } = request.query as any;
    const suggestions: Record<string, string[]> = {
      '/dashboard': [
        'What is our projected revenue for the next event?',
        'Which departments are underperforming against forecast?',
        'What operational risks should I know about for tonight?',
      ],
      '/concessions': [
        'Why were concession sales down last night?',
        'What inventory should we order for Saturday\'s game?',
        'Which stands are most at risk of stocking out tonight?',
      ],
      '/ticketing': [
        'How is ticket sales velocity tracking vs. comparable events?',
        'Which season ticket accounts are most at risk of not renewing?',
        'What sections should we reprice for next week\'s game?',
      ],
      '/security': [
        'What are the highest risk areas for tonight\'s event?',
        'How does tonight\'s expected attendance compare to our capacity plan?',
      ],
      '/sponsorship': [
        'Which sponsors are underperforming against contracted deliverables?',
        'Which sponsor contracts are expiring in the next 60 days?',
      ],
      default: [
        'What happened at last night\'s event?',
        'What is our season-to-date revenue vs. budget?',
        'What are our top 3 priorities right now?',
      ],
    };

    return { success: true, data: suggestions[page] ?? suggestions['default'] };
  });

  // DELETE conversation session (clear chat history)
  app.delete('/session/:session_id', async (request, reply) => {
    const { session_id } = request.params as any;
    const { getRedis } = await import('@venueiq/shared-utils');
    await getRedis().del(`nlq:session:${session_id}`);
    return { success: true };
  });
}
