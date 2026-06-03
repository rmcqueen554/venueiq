import { createServer, IncomingMessage, ServerResponse } from 'http';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const PORT = parseInt(process.env.PORT ?? '10000');

// Start an HTTP server immediately so /health responds within seconds.
// Fastify registers as the handler after it finishes loading.
let fastifyReady = false;
let fastifyHandler: ((req: IncomingMessage, res: ServerResponse) => void) | null = null;

const httpServer = createServer((req, res) => {
  // Health check — always respond immediately, even before Fastify is ready
  if (req.url === '/health' || req.url === '/health/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'venueiq-api', version: '1.0.0', ts: new Date().toISOString(), ready: fastifyReady }));
    return;
  }
  // Once Fastify is ready, delegate everything else to it
  if (fastifyHandler) {
    fastifyHandler(req, res);
  } else {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Starting up...' }));
  }
});

httpServer.listen(PORT, '0.0.0.0', () => {
  logger.info({ port: PORT }, 'Health endpoint live — loading Fastify...');
  loadFastify().catch((err) => {
    logger.error(err, 'Fastify failed to load');
    // Don't exit — health check still works, we can debug
  });
});

async function loadFastify() {
  const { default: Fastify } = await import('fastify');
  const { default: cors }    = await import('@fastify/cors');
  const { default: helmet }  = await import('@fastify/helmet');
  const { default: multipart } = await import('@fastify/multipart');
  const { Server: SocketIOServer } = await import('socket.io');
  const { tenantsRoutes }     = await import('./routes/tenants');
  const { executiveRoutes }   = await import('./routes/executive');
  const { concessionsRoutes } = await import('./routes/concessions');
  const { securityRoutes }    = await import('./routes/security');
  const { parkingRoutes }     = await import('./routes/parking');
  const { facilitiesRoutes }  = await import('./routes/facilities');
  const { agentsRoutes }      = await import('./routes/agents');
  const { nlqRoutes }         = await import('./routes/nlq');
  const { startAgentScheduler } = await import('./agents/scheduler');

  const app = Fastify({ logger: false, trustProxy: true, serverFactory: () => httpServer });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: process.env.FRONTEND_URL ?? '*', credentials: true });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

  // Health check route (Fastify version — takes over once ready)
  app.get('/health', async () => ({
    status: 'ok', service: 'venueiq-api', version: '1.0.0',
    ts: new Date().toISOString(), ready: true,
  }));

  // Clerk auth (non-critical)
  if (process.env.CLERK_SECRET_KEY) {
    try {
      const { clerkPlugin } = await import('@clerk/fastify');
      await app.register(clerkPlugin);
      logger.info('Clerk auth initialized');
    } catch (err) {
      logger.warn({ err }, 'Clerk init failed — continuing without auth');
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
    logger.error({ err: error }, 'Request error');
    reply.status(error.statusCode ?? 500).send({
      success: false,
      error: { code: error.code ?? 'INTERNAL_ERROR', message: error.message },
    });
  });

  // Tell Fastify to use our existing httpServer (via serverFactory)
  await app.ready();

  // Switch the handler so all non-health requests go to Fastify
  fastifyHandler = app.routing.bind(app);
  fastifyReady = true;
  logger.info('Fastify fully loaded — all routes active');

  // Attach Socket.io
  const io = new SocketIOServer(httpServer, {
    cors: { origin: process.env.FRONTEND_URL ?? '*', credentials: true },
    transports: ['websocket', 'polling'],
  });
  io.on('connection', (socket) => {
    const tenantId = socket.handshake.auth.tenant_id as string;
    if (tenantId) socket.join(`tenant:${tenantId}`);
  });

  // Start scheduler
  try { startAgentScheduler(); } catch (err) { logger.warn({ err }, 'Scheduler failed'); }
}
