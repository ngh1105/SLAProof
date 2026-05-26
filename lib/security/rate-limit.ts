// Lightweight in-memory token-bucket rate limiter.
// Suitable for single-process pilot deployments. Replace with Redis-backed
// implementation when moving to multi-instance production.

type Bucket = { tokens: number; lastRefillMs: number };

export type RateLimitConfig = {
  capacity: number;
  refillPerSecond: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export type RateLimiter = {
  hit(key: string): RateLimitResult;
  reset(key?: string): void;
};

export function createRateLimiter(config: RateLimitConfig, now: () => number = () => Date.now()): RateLimiter {
  const buckets = new Map<string, Bucket>();

  function refill(bucket: Bucket, currentMs: number): void {
    const elapsedMs = currentMs - bucket.lastRefillMs;
    if (elapsedMs <= 0) return;
    const delta = (elapsedMs / 1000) * config.refillPerSecond;
    bucket.tokens = Math.min(config.capacity, bucket.tokens + delta);
    bucket.lastRefillMs = currentMs;
  }

  return {
    hit(key: string): RateLimitResult {
      const currentMs = now();
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { tokens: config.capacity, lastRefillMs: currentMs };
        buckets.set(key, bucket);
      }
      refill(bucket, currentMs);

      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return {
          allowed: true,
          remaining: Math.floor(bucket.tokens),
          retryAfterMs: 0,
        };
      }
      const deficit = 1 - bucket.tokens;
      const retryAfterMs = Math.ceil((deficit / config.refillPerSecond) * 1000);
      return { allowed: false, remaining: 0, retryAfterMs };
    },
    reset(key?: string): void {
      if (key === undefined) buckets.clear();
      else buckets.delete(key);
    },
  };
}
