import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/lib/security/rate-limit";

describe("createRateLimiter", () => {
  it("allows up to capacity hits then blocks", () => {
    const now = 0;
    const rl = createRateLimiter({ capacity: 3, refillPerSecond: 1 }, () => now);
    expect(rl.hit("alice").allowed).toBe(true);
    expect(rl.hit("alice").allowed).toBe(true);
    expect(rl.hit("alice").allowed).toBe(true);
    const blocked = rl.hit("alice");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("isolates buckets by key", () => {
    const now = 0;
    const rl = createRateLimiter({ capacity: 1, refillPerSecond: 1 }, () => now);
    expect(rl.hit("alice").allowed).toBe(true);
    expect(rl.hit("alice").allowed).toBe(false);
    expect(rl.hit("bob").allowed).toBe(true);
  });

  it("refills tokens over time", () => {
    let now = 0;
    const rl = createRateLimiter({ capacity: 2, refillPerSecond: 2 }, () => now);
    rl.hit("alice");
    rl.hit("alice");
    expect(rl.hit("alice").allowed).toBe(false);
    now += 1100; // 1.1s -> ~2.2 tokens refilled, capped at 2
    expect(rl.hit("alice").allowed).toBe(true);
    expect(rl.hit("alice").allowed).toBe(true);
    expect(rl.hit("alice").allowed).toBe(false);
  });

  it("reset clears specific key", () => {
    const now = 0;
    const rl = createRateLimiter({ capacity: 1, refillPerSecond: 1 }, () => now);
    rl.hit("alice");
    expect(rl.hit("alice").allowed).toBe(false);
    rl.reset("alice");
    expect(rl.hit("alice").allowed).toBe(true);
  });

  it("retryAfterMs is realistic for refill rate", () => {
    const now = 0;
    const rl = createRateLimiter({ capacity: 1, refillPerSecond: 2 }, () => now);
    rl.hit("alice");
    const blocked = rl.hit("alice");
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(500);
  });
});
