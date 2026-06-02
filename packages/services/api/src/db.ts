import { PrismaClient } from './generated/prisma';

// Singleton Prisma client — one connection pool for the whole monolith
let _db: PrismaClient | null = null;

export function getDb(): PrismaClient {
  if (!_db) {
    _db = new PrismaClient({
      log: process.env.NODE_ENV === 'development'
        ? [{ emit: 'event', level: 'query' }, { emit: 'event', level: 'error' }]
        : [{ emit: 'event', level: 'error' }],
    });
  }
  return _db;
}

export const db = getDb();
