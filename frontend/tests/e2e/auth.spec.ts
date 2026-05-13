import { test, expect, Page } from "@playwright/test";

// ── Helpers ───────────────────────────────────────────────────
async function fillLoginForm(page: Page, email: string, password: string): Promise<void> {
  await page.fill("#email",    email);
  await page.fill("#password", password);
}

// ── Tests ─────────────────────────────────────────────────────
test.describe("Login flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("displays login form on /login", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Welcome back");
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator("#login-submit")).toBeVisible();
  });

  test("shows error on invalid credentials", async ({ page }) => {
    // Mock API to return 401
    await page.route("**/api/auth/login", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Invalid credentials" }),
      })
    );

    await fillLoginForm(page, "wrong@example.com", "wrongpassword");
    await page.click("#login-submit");

    await expect(page.getByRole("alert")).toContainText("Invalid credentials");
  });

  test("redirects to /dashboard on successful login", async ({ page }) => {
    // Mock API to return 200 with token
    await page.route("**/api/auth/login", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          token: "fake-jwt-token",
          user: { id: 1, name: "Alice", email: "alice@example.com" },
        }),
      })
    );

    await fillLoginForm(page, "alice@example.com", "securePass123");
    await page.click("#login-submit");

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator("h1")).toContainText("Dashboard");
  });
});

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    // Inject auth token directly into localStorage
    await page.addInitScript(() => {
      localStorage.setItem(
        "auth-storage",
        JSON.stringify({
          state: { token: "fake-token", user: { id: 1, name: "Alice", email: "alice@example.com" } },
          version: 0,
        })
      );
    });
    await page.goto("/dashboard");
  });

  test("shows user name and stats", async ({ page }) => {
    await expect(page.getByText("Welcome back, Alice")).toBeVisible();
    await expect(page.getByText("Pipeline Runs")).toBeVisible();
    await expect(page.getByText("Success Rate")).toBeVisible();
  });

  test("logout button clears auth and redirects to /login", async ({ page }) => {
    await page.click("#logout-btn");
    await expect(page).toHaveURL(/\/login/);

    // Auth should be cleared from localStorage
    const stored = await page.evaluate(() => localStorage.getItem("auth-storage"));
    const parsed = JSON.parse(stored ?? "{}");
    expect(parsed.state?.token).toBeNull();
  });
});
