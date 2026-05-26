import { describe, expect, it } from "vitest";
import { parseMonitoringCsv } from "@/lib/domain/monitoring-csv";

describe("parseMonitoringCsv", () => {
  it("parses a valid 3-row CSV with correct summary", () => {
    const csv = [
      "timestamp,total_requests,failed_requests",
      "2026-05-22T10:00:00Z,1000,50",
      "2026-05-22T10:05:00Z,1200,200",
      "2026-05-22T10:10:00Z,800,30",
    ].join("\n");
    const result = parseMonitoringCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(3);
    expect(result.rows[1].errorRate).toBeCloseTo(200 / 1200, 4);
    expect(result.summary).toContain("Total requests: 3,000");
    expect(result.summary).toContain("Failed requests: 280");
  });

  it("rejects empty input", () => {
    expect(parseMonitoringCsv("")).toMatchObject({ ok: false });
    expect(parseMonitoringCsv("   \n  ")).toMatchObject({ ok: false });
  });

  it("rejects when required headers are missing", () => {
    const result = parseMonitoringCsv("timestamp,latency\n2026-01-01,100");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/missing required headers/i);
  });

  it("rejects when failed > total", () => {
    const csv = [
      "timestamp,total_requests,failed_requests",
      "2026-05-22T10:00:00Z,100,200",
    ].join("\n");
    const result = parseMonitoringCsv(csv);
    expect(result.ok).toBe(false);
  });

  it("ignores invalid rows but keeps valid ones", () => {
    const csv = [
      "timestamp,total_requests,failed_requests",
      "2026-05-22T10:00:00Z,bad,50",
      "2026-05-22T10:05:00Z,1000,100",
    ].join("\n");
    const result = parseMonitoringCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(1);
  });

  it("treats total=0 as 0% error rate (no NaN)", () => {
    const csv = [
      "timestamp,total_requests,failed_requests",
      "2026-05-22T10:00:00Z,0,0",
    ].join("\n");
    const result = parseMonitoringCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].errorRate).toBe(0);
  });
});
