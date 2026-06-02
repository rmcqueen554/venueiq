import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

// Factory: creates a Prisma client for a given service database URL
// with Row-Level Security enforcement baked in.
export function createPrismaClient(databaseUrl: string): PrismaClient {
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });

  // Log slow queries in development
  if (process.env.NODE_ENV !== 'production') {
    (prisma as any).$on('query', (e: any) => {
      if (e.duration > 500) {
        logger.warn({ query: e.query, duration: e.duration }, 'Slow query detected');
      }
    });
  }

  (prisma as any).$on('error', (e: any) => {
    logger.error({ message: e.message }, 'Prisma error');
  });

  return prisma;
}

// Middleware that enforces tenant_id on every query (defence-in-depth layer)
export function addTenantMiddleware(prisma: PrismaClient, tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query, model, operation }: any) {
          // For read operations, inject tenant_id filter
          if (['findMany', 'findFirst', 'findUnique', 'count', 'aggregate'].includes(operation)) {
            args.where = { ...args.where, tenant_id: tenantId };
          }
          // For create operations, inject tenant_id
          if (operation === 'create') {
            args.data = { ...args.data, tenant_id: tenantId };
          }
          if (operation === 'createMany') {
            args.data = args.data.map((d: any) => ({ ...d, tenant_id: tenantId }));
          }
          return query(args);
        },
      },
    },
  });
}
