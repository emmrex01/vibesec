import { expect, test } from "@playwright/test";

/**
 * Requires: dev server connected to a TEST Supabase project, and E2E_TARGET_URL pointing at a
 * site you own (the scanner makes real passive requests to it). Never use an unrelated live site.
 */
const TARGET = process.env.E2E_TARGET_URL;

test("homepage navigation and key sections", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Is Your Website");
  await expect(page.getByText("Check My Website for Free")).toBeVisible();
  await page.getByRole("link", { name: "Explore Our Security Services" }).click();
  await expect(page).toHaveURL(/\/services/);
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
});

test("assessment form validation", async ({ page }) => {
  await page.goto("/assessment");
  await page.getByLabel(/Website URL/).fill("http://localhost");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("alert").first()).toContainText(/cannot be assessed|valid/i);
  await page.getByLabel(/Website URL/).fill("https://example.com");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Please enter your full name")).toBeVisible();
});

test("successful submission, progress, results and PDF download", async ({ page }) => {
  test.skip(!TARGET, "Set E2E_TARGET_URL to a website you own");
  await page.goto("/assessment");
  await page.getByLabel(/Website URL/).fill(TARGET!);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel(/Full name/).fill("E2E Tester");
  await page.getByLabel(/Business email/).fill("e2e@vibesec-test.com");
  await page.getByLabel(/Company name/).fill("E2E Ltd");
  await page.getByLabel(/Country/).selectOption("United Kingdom");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText(/I confirm that I own this website/).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Start Free Security Assessment" }).click();
  await expect(page).toHaveURL(/\/report\//);
  await expect(page.getByText(/Assessment in progress|configuration score|Checks performed/)).toBeVisible();
  await expect(page.getByText("Checks performed")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(/not a certification/)).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: /Download PDF report/ }).click();
  expect((await download).suggestedFilename()).toMatch(/^VSH-\d{4}-/);
  await page.getByRole("link", { name: "Want Help Fixing These Findings?" }).first().click();
  await expect(page).toHaveURL(/\/contact\?source=report/);
});

test("contact form submission", async ({ page }) => {
  await page.goto("/contact");
  await page.getByLabel(/Full name/).fill("E2E Tester");
  await page.getByLabel(/Business email/).fill("e2e@vibesec-test.com");
  await page.getByLabel(/^Message/).fill("Automated end-to-end test message — please ignore.");
  await page.getByRole("button", { name: "Request a consultation" }).click();
  await expect(page.getByText(/request has been received/)).toBeVisible();
});

test("invalid report token shows a safe error", async ({ page }) => {
  await page.goto("/report/not-a-real-token");
  await expect(page.getByText(/not valid|not found/i)).toBeVisible();
});
