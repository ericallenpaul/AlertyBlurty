import { expect, test } from "@playwright/test";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:5041";

test("registered user can sign in and reach the dashboard", async ({
  page,
  request,
}) => {
  const uniqueId = Date.now();
  const email = `playwright-${uniqueId}@example.com`;
  const password = "SecurePassword123!";

  const registration = await request.post(`${apiBaseUrl}/api/auth/register`, {
    data: {
      email,
      password,
      fullName: "Playwright Test User",
      phoneNumber: "+15555550123",
      timezone: "UTC",
      organizationName: `Playwright Org ${uniqueId}`,
    },
  });

  expect(registration.ok()).toBeTruthy();

  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Active Incidents" }).first(),
  ).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
