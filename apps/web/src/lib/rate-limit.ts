import IORedis from "ioredis";

let redis: IORedis | null = null;

function getRedis() {
  if (!redis) {
    redis = new IORedis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }
  return redis;
}

/** Simple fixed-window rate limit. Returns true if allowed. */
export async function rateLimit(params: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<boolean> {
  try {
    const r = getRedis();
    if (r.status !== "ready") await r.connect().catch(() => undefined);
    const fullKey = `rl:${params.key}`;
    const count = await r.incr(fullKey);
    if (count === 1) await r.expire(fullKey, params.windowSeconds);
    return count <= params.limit;
  } catch {
    // Fail open if Redis is down (still log in production)
    return true;
  }
}
