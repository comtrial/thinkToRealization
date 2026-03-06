import { defineConfig } from "@playwright/test";
import path from "path";

const PORT = 3333;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 2,
  workers: 1,
  reporter: "html",
  timeout: 30000,
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      NODE_OPTIONS: "--max-old-space-size=4096",
      DATABASE_URL: `file:${path.resolve(__dirname, "prisma/test.db")}`,
      NODE_ENV: "test",
      BYPASS_AUTH: "true",
    },
  },
});
