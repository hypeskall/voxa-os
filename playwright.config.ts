import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://localhost:3100",
    headless: true,
    locale: "ro-RO",
    channel: process.platform === "win32" ? "msedge" : "chromium",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node tests/fixtures/supabase.mjs",
      url: "http://127.0.0.1:54329/health",
      reuseExistingServer: false,
      env: { VOXA_TEST_ENCRYPTION: "true" },
    },
    {
      command: "npm run dev -- --port 3100",
      url: "http://localhost:3100/login",
      reuseExistingServer: false,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-only-public-key",
        SUPABASE_SERVICE_ROLE_KEY: "test-only-service-key",
        PATIENT_ENCRYPTION_KEYRING: JSON.stringify({ active: "test-v1", keys: { "test-v1": "a1".repeat(32) }, index: "b2".repeat(32) }),
        PATIENT_ENCRYPTION_READ_LEGACY: "false",
        BOOKING_RATE_LIMIT_SALT: "test-only-booking-salt-never-production",
        APP_ORIGIN: "http://localhost:3100",
      },
    },
  ],
});
