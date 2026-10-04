import { defineConfig } from "@playwright/test";
import { stagingEnv } from "./scripts/staging-env.mjs";
const config = stagingEnv();
export default defineConfig({
  testDir: "./tests/hosted-browser",
  workers: 1,
  fullyParallel: false,
  timeout: 60000,
  expect: { timeout: 15000 },
  outputDir: "test-results/hosted",
  use: {
    baseURL: config.origin,
    headless: true,
    channel: process.platform === "win32" ? "msedge" : "chromium",
    // Auth links, credentials and patient content must not be retained in traces.
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  // Intentionally no webServer and no fixture adapter: this suite is hosted only.
});
