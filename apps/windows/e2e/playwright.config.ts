import { defineConfig } from "@playwright/test";
import { APP_ORIGIN, FAKE_ORIGIN } from "./constants";

const fakePort = new URL(FAKE_ORIGIN).port;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL: APP_ORIGIN,
    colorScheme: "light",
    viewport: { width: 1280, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
    screenshot: "on",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: `python3 ../../contract/fake/hermes_fake.py --host 127.0.0.1 --port ${fakePort}`,
      cwd: "..",
      env: { ...process.env, HERMES_FAKE_TEST_HOOKS: "1" },
      url: `${FAKE_ORIGIN}/api/health`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: "npm run e2e:serve",
      cwd: "..",
      url: APP_ORIGIN,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
