import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { Server as SocketIOServer } from 'socket.io';
import pino from 'pino';
import { tenantsRoutes } from './routes/tenants';
import { executiveRoutes } from './routes/executive';
import { concessionsRoutes } from './routes/concessions';
import { securityRoutes } from './routes/security';
import { parkingRoutes } from './routes/parking';
import { facilitiesRoutes } from './routes/facilities';
import { agentsRoutes } from './routes/agents';
import { nlqRoutes } from './routes/nlq';
import { startAgentScheduler } from './agents/scheduler';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
export let io: SocketIOServer | null = null;

const app = Fastify({ logger: false, trustProxy: true });

async function bootstrap() {
  // Register health check FIRST — before anything that might throw
  app.get('/health', async () => ({
    status: 'ok', service: 'venueiq-api', version: '1.0.0',
    ts: new Date().toISOString(),
  }));

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: process.env.FRONTEND_URL ?? '*', credentials: true });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

  // Clerk — non-critical, skip if it fails
  if (process.env.CLERK_SECRET_KEY) {
    try {
      const { clerkPlugin } = await import('@clerk/fastify');
      await app.register(clerkPlugin);
    } catch (err) {
      logger.warn('Clerk skipped:', err);
    }
  }

  await app.register(tenantsRoutes,     { prefix: '/api' });
  await app.register(executiveRoutes,   { prefix: '/api' });
  await app.register(concessionsRoutes, { prefix: '/api' });
  await app.register(securityRoutes,    { prefix: '/api' });
  await app.register(parkingRoutes,     { prefix: '/api' });
  await app.register(facilitiesRoutes,  { prefix: '/api' });
  await app.register(agentsRoutes,      { prefix: '/api' });
  await app.register(nlqRoutes,         { prefix: '/api' });

  app.setErrorHandler((error, _req, reply) => {
    reply.status(error.statusCode ?? 500).send({
      success: false,
      error: { code: error.code ?? 'INTERNAL_ERROR', message: error.message },
    });
  });

  const port = parseInt(process.env.PORT ?? '10000');
  await app.listen({ port, host: '0.0.0.0' });
  logger.info({ port }, 'VenueIQ API started');

  io = new SocketIOServer(app.server, {
    cors: { origin: process.env.FRONTEND_URL ?? '*', credentials: true },
    transports: ['websocket', 'polling'],
  });
  io.on('connection', (socket) => {
    const tenantId = socket.handshake.auth.tenant_id as string;
    if (tenantId) socket.join(`tenant:${tenantId}`);
  });

  try { startAgentScheduler(); } catch { /* non-critical */ }
}

bootstrap().catch((err) => {
  logger.error(err, 'Startup failed');
  process.exit(1);
});
