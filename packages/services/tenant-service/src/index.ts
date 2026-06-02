import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { clerkPlugin } from '@clerk/fastify';
import { logger } from '@venueiq/shared-utils';
import { onboardingRoutes } from './routes/onboarding.routes';
import { tenantRoutes } from './routes/tenant.routes';
import { userRoutes } from './routes/users.routes';
import { billingRoutes } from './routes/billing.routes';

const app = Fastify({ logger: false, trustProxy: true });

async function bootstrap() {
  // Security
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: process.env.FRONTEND_URL ?? '*',
    credentials: true,
  });
  await app.register(rateLimit, { max: 200, timeWindow: '1 minute' });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB CSV uploads

  // Auth
  await app.register(clerkPlugin);

  // Health check (no auth required)
  app.get('/health', async () => ({ status: 'ok', service: 'tenant-service', ts: new Date().toISOString() }));

  // Routes
  await app.register(onboardingRoutes, { prefix: '/api/onboarding' });
  await app.register(tenantRoutes, { prefix: '/api/tenants' });
  await app.register(userRoutes, { prefix: '/api/users' });
  await app.register(billingRoutes, { prefix: '/api/billing' });

  // Error handler
  app.setErrorHandler((error, request, reply) => {
    logger.error({ err: error, url: request.url }, 'Unhandled error');
    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      success: false,
      error: { code: error.code ?? 'INTERNAL_ERROR', message: error.message },
    });
  });

  const port = parseInt(process.env.PORT ?? '3001');
  await app.listen({ port, host: '0.0.0.0' });
  logger.info({ port, service: 'tenant-service' }, 'Service started');
}

bootstrap().catch((err) => {
  logger.error(err, 'Failed to start tenant-service');
  process.exit(1);
});
