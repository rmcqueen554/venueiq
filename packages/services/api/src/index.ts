import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { clerkPlugin } from '@clerk/fastify';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import pino from 'pino';
import { db } from './db';
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

// ── Fastify app ────────────────────────────────────────────────────────────
const app = Fastify({ logger: false, trustProxy: true });
const httpServer = createServer(app.server as any);

// ── Socket.io (realtime) ───────────────────────────────────────────────────
export const io = new SocketIOServer(httpServer, {
  cors: { origin: process.env.FRONTEND_URL ?? '*', credentials: true },
  transports: ['websocket', 'polling'],
});

io.on('connection', (socket) => {
  const tenantId = socket.handshake.auth.tenant_id as string;
  if (tenantId) socket.join(`tenant:${tenantId}`);
});

async function bootstrap() {
  // Security & middleware
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: process.env.FRONTEND_URL ?? '*',
    credentials: true,
  });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });
  await app.register(clerkPlugin);

  // Health check — no auth
  app.get('/health', async () => ({
    status: 'ok',
    service: 'venueiq-api',
    version: '1.0.0',
    ts: new Date().toISOString(),
  }));

  // Register all route modules
  await app.register(tenantsRoutes,    { prefix: '/api' });
  await app.register(executiveRoutes,  { prefix: '/api' });
  await app.register(concessionsRoutes,{ prefix: '/api' });
  await app.register(securityRoutes,   { prefix: '/api' });
  await app.register(parkingRoutes,    { prefix: '/api' });
  await app.register(facilitiesRoutes, { prefix: '/api' });
  await app.register(agentsRoutes,     { prefix: '/api' });
  await app.register(nlqRoutes,        { prefix: '/api' });

  // Global error handler
  app.setErrorHandler((error, _req, reply) => {
    logger.error({ err: error }, 'Request error');
    reply.status(error.statusCode ?? 500).send({
      success: false,
      error: { code: error.code ?? 'INTERNAL_ERROR', message: error.message },
    });
  });

  // Start AI agent scheduler (CRON-based, no Redis needed)
  startAgentScheduler();

  // Listen
  const port = parseInt(process.env.PORT ?? '10000');
  await new Promise<void>((resolve) => httpServer.listen(port, '0.0.0.0', resolve));
  logger.info({ port }, 'VenueIQ API started');
}

bootstrap().catch((err) => {
  logger.error(err, 'Failed to start API');
  process.exit(1);
});
