import { expect, test } from "@playwright/test";

const EMAIL = process.env.E2E_ADMIN_EMAIL;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD;

test("anonymous visitors are redirected away from admin pages", async ({ page, request }) => {
  await page.goto("/admin/leads");
  await expect(page).toHaveURL(/\/admin\/login/);
  const api = await request.get("/api/admin/leads");
  expect(api.status()).toBe(401);
  const exp = await request.get("/api/admin/export");
  expect(exp.status()).toBe(401);
});

test("admin login and lead management", async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for an admin user in the TEST project");
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(EMAIL!);
  await page.getByLabel("Password").fill(PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await expect(page.getByText("Total leads")).toBeVisible();
  await page.getByRole("link", { name: "Leads" }).click();
  await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();
  const first = page.locator("tbody a").first();
  if (await first.count()) {
    await first.click();
    await page.getByLabel("Add a timeline note").fill("E2E note");
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByText("E2E note")).toBeVisible();
  }
  const [download] = await Promise.all([page.waitForEvent("download"), page.goto("/admin/leads").then(() => page.getByRole("link", { name: /Export CSV/ }).click())]);
  expect(download.suggestedFilename()).toMatch(/vibesec-leads-.*\.csv/);
});
