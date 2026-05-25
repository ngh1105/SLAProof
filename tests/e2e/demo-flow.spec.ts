import { expect, test } from "@playwright/test";

test("dashboard opens breach case and renders a receipt export", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "RPC incidents become breach receipts." })).toBeVisible();
  await expect(page.getByText("Ethereum read endpoint sustained 5xx errors")).toBeVisible();

  await page.getByRole("link", { name: /Open breach case/i }).click();

  await expect(page.getByRole("heading", { name: /Ethereum read endpoint/i })).toBeVisible();
  await expect(page.getByText("5% request failures for 5+ consecutive minutes")).toBeVisible();
  await expect(page.getByText("Provider status page incident")).toBeVisible();

  await page.getByRole("button", { name: /Submit to verifier/i }).click();

  await expect(page.getByRole("heading", { name: /Northstar RPC verdict: breach/i })).toBeVisible();
  await expect(page.getByText("% confidence")).toBeVisible();
  await expect(page.getByTestId("json-export")).toContainText('"decision": "breach"');
  await expect(page.getByTestId("markdown-export")).toContainText("Decision: breach");
});

test("inconclusive case keeps uncertainty visible", async ({ page }) => {
  await page.goto("/cases/case-rpc-inconclusive-003");

  await expect(page.getByRole("heading", { name: /Polygon archive endpoint stale reads/i })).toBeVisible();
  await expect(page.locator(".status.inconclusive").first()).toBeVisible();

  await page.getByRole("button", { name: /Submit to verifier/i }).click();

  await expect(page.getByRole("heading", { name: /ArchiveLane verdict: inconclusive/i })).toBeVisible();
  await expect(page.locator("dd", { hasText: "Collect a probe summary" })).toBeVisible();
});
