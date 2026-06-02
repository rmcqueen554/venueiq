import Redis from 'ioredis';
import { logger } from './logger';

let redisInstance: Redis | null = null;

export function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      lazyConnect: false,
    });

    redisInstance.on('connect', () => logger.info('Redis connected'));
    redisInstance.on('error', (err) => logger.error({ err }, 'Redis error'));
    redisInstance.on('reconnecting', () => logger.warn('Redis reconnecting'));
  }
  return redisInstance;
}

// ── Session / Cache helpers ────────────────────────────────────────────────
export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await getRedis().get(key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
  await getRedis().set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

export async function cacheDel(key: string): Promise<void> {
  await getRedis().del(key);
}

// ── NLQ conversation session ──────────────────────────────────────────────
export async function getSession(sessionId: string): Promise<Array<{ role: string; content: string }>> {
  const raw = await getRedis().lrange(`nlq:session:${sessionId}`, 0, 19); // last 10 turns = 20 messages
  return raw.map((r) => JSON.parse(r));
}

export async function appendSession(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
): Promise<void> {
  const key = `nlq:session:${sessionId}`;
  await getRedis().rpush(key, JSON.stringify({ role, content }));
  await getRedis().ltrim(key, -20, -1); // keep last 20 messages
  await getRedis().expire(key, 3600); // 1 hour TTL
}

// ── Rate limiting ─────────────────────────────────────────────────────────
export async function rateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const redis = getRedis();
  const current = await redis.incr(key);
  if (current === 1) await redis.expire(key, windowSeconds);
  return { allowed: current <= maxRequests, remaining: Math.max(0, maxRequests - current) };
}

// ── Pub/Sub for real-time events ──────────────────────────────────────────
export function createPubSub() {
  const pub = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  const sub = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  return { pub, sub };
}
