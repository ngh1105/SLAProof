import { expect, test } from "@playwright/test";

test("ops page renders verifier readiness + schema info", async ({ page }) => {
  await page.goto("/ops");
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { name: "Ops dashboard" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("heading", { name: "Verifier readiness" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Schema" })).toBeVisible();
  await expect(page.getByText(/slaproof\.receipt\.v0/).first()).toBeVisible();
});

test("audit page is reachable and shows the empty-state copy when no entries", async ({ page }) => {
  await page.goto("/audit");

  await expect(page.getByRole("heading", { name: /Case audit log/i })).toBeVisible();
  // Empty state OR a populated table — both are acceptable in the demo run.
  const empty = page.getByText(/No audit entries yet/i);
  const populated = page.getByRole("columnheader", { name: /Action/i });
  await expect(empty.or(populated)).toBeVisible();
});

test("/api/health responds 200 in mock mode", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe("ok");
  expect(body.verifier.mode).toBe("mock");
});

test("/api/version exposes app + receipt schema info", async ({ request }) => {
  const res = await request.get("/api/version");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.app).toMatch(/^\d/);
  expect(body.receipt.current).toBe("slaproof.receipt.v0");
});
