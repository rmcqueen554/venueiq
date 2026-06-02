import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { clerkPlugin } from '@clerk/fastify';
import { logger } from '@venueiq/shared-utils';
import { queryRoutes } from './routes/query.routes';

const app = Fastify({ logger: false, trustProxy: true });

async function bootstrap() {
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: process.env.FRONTEND_URL ?? '*', credentials: true });
  await app.register(clerkPlugin);

  app.get('/health', async () => ({ status: 'ok', service: 'nlq-service' }));
  await app.register(queryRoutes, { prefix: '/api/nlq' });

  app.setErrorHandler((error, _req, reply) => {
    logger.error({ err: error }, 'NLQ service error');
    reply.status(error.statusCode ?? 500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } });
  });

  const port = parseInt(process.env.PORT ?? '3012');
  await app.listen({ port, host: '0.0.0.0' });
  logger.info({ port }, 'NLQ Service started');
}

bootstrap().catch((err) => { logger.error(err); process.exit(1); });
