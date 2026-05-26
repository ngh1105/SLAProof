import { afterEach, describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { POST as cspReportPost } from "@/app/api/csp-report/route";
import { snapshot, resetMetrics } from "@/lib/observability/metrics";

function buildRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/csp-report", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("/api/csp-report", () => {
  afterEach(() => resetMetrics());

  it("accepts a csp-report payload and returns 204", async () => {
    const res = await cspReportPost(
      buildRequest({
        "csp-report": {
          "violated-directive": "script-src",
          "blocked-uri": "https://evil.example.com/x.js",
        },
      }),
    );
    expect(res.status).toBe(204);
    expect(snapshot().counters.csp_report_received).toBe(1);
  });

  it("accepts an array of reports", async () => {
    const res = await cspReportPost(buildRequest([{ a: 1 }, { b: 2 }]));
    expect(res.status).toBe(204);
    expect(snapshot().counters.csp_report_received).toBe(2);
  });

  it("returns 400 on invalid JSON body", async () => {
    const req = new Request("http://localhost/api/csp-report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    }) as unknown as NextRequest;
    const res = await cspReportPost(req);
    expect(res.status).toBe(400);
    expect(snapshot().counters.csp_report_invalid_body).toBe(1);
  });
});
