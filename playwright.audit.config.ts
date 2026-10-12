import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({...base,outputDir:".staging-deploy/audit-browser-results",use:{...base.use,baseURL:"http://localhost:3110"},webServer:[
 {command:"node tests/fixtures/supabase.mjs",url:"http://127.0.0.1:54339/health",reuseExistingServer:false,env:{VOXA_TEST_ENCRYPTION:"true",VOXA_FIXTURE_PORT:"54339",VOXA_FIXTURE_APP_ORIGIN:"http://localhost:3110"}},
 {command:"npm run dev -- --port 3110",url:"http://localhost:3110/login",reuseExistingServer:false,env:{VOXA_AUDIT_TEST:"true",NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:54339",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"test-only-public-key",SUPABASE_SERVICE_ROLE_KEY:"test-only-service-key",PATIENT_ENCRYPTION_KEYRING:JSON.stringify({active:"test-v1",keys:{"test-v1":"a1".repeat(32)},index:"b2".repeat(32)}),PATIENT_ENCRYPTION_READ_LEGACY:"false",BOOKING_RATE_LIMIT_SALT:"test-only-booking-salt-never-production",APP_ORIGIN:"http://localhost:3110"}}
]});
