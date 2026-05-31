// Lightweight in-memory metrics collector for the pilot.
// Counters and histograms only — gauges live in /api/health for now.
// Replace with OpenTelemetry exporter when shipping to production.

export type CounterSnapshot = Record<string, number>;
export type HistogramSnapshot = Record<string, { count: number; sum: number; min: number; max: number; avg: number }>;

export type MetricsSnapshot = {
  counters: CounterSnapshot;
  histograms: HistogramSnapshot;
  // Consecutive-event streaks (e.g. consecutive failures). Unlike counters,
  // a streak resets to 0 on the opposing event, so it reflects *current*
  // health rather than lifetime totals.
  streaks: CounterSnapshot;
  collectedAt: string;
};

const counters = new Map<string, number>();
const histograms = new Map<string, { count: number; sum: number; min: number; max: number }>();
const streaks = new Map<string, number>();

export function increment(name: string, by = 1): void {
  counters.set(name, (counters.get(name) ?? 0) + by);
}

export function observe(name: string, value: number): void {
  const cur = histograms.get(name);
  if (!cur) {
    histograms.set(name, { count: 1, sum: value, min: value, max: value });
    return;
  }
  cur.count += 1;
  cur.sum += value;
  if (value < cur.min) cur.min = value;
  if (value > cur.max) cur.max = value;
}

// Increment a consecutive-event streak and return its new value. Pair with
// resetStreak() on the opposing event so the streak measures "how many in a
// row right now", not a lifetime total.
export function bumpStreak(name: string): number {
  const next = (streaks.get(name) ?? 0) + 1;
  streaks.set(name, next);
  return next;
}

// Reset a streak to 0 (the opposing event happened). Idempotent.
export function resetStreak(name: string): void {
  streaks.set(name, 0);
}

export function snapshot(): MetricsSnapshot {
  const counterOut: CounterSnapshot = {};
  for (const [k, v] of counters) counterOut[k] = v;

  const histOut: HistogramSnapshot = {};
  for (const [k, h] of histograms) {
    histOut[k] = {
      count: h.count,
      sum: h.sum,
      min: h.min,
      max: h.max,
      avg: h.count === 0 ? 0 : h.sum / h.count,
    };
  }

  const streakOut: CounterSnapshot = {};
  for (const [k, v] of streaks) streakOut[k] = v;

  return {
    counters: counterOut,
    histograms: histOut,
    streaks: streakOut,
    collectedAt: new Date().toISOString(),
  };
}

export function resetMetrics(): void {
  counters.clear();
  histograms.clear();
  streaks.clear();
}
