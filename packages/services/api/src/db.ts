import { PrismaClient } from './generated/prisma';

let _db: PrismaClient | null = null;

export function getDb(): PrismaClient {
  if (!_db) {
    _db = new PrismaClient({
      datasourceUrl: process.env.DATABASE_URL,
      log: process.env.NODE_ENV === 'development'
        ? [{ emit: 'event', level: 'error' }]
        : [{ emit: 'event', level: 'error' }],
    });
  }
  return _db;
}

export const db = getDb();
