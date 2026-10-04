import { afterEach, expect, it, vi } from "vitest";
import { onRequestError } from "../src/instrumentation";
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});
it("logs only a reference and route type, excluding clinical content and credentials",async()=>{
  vi.stubEnv("ERROR_ALERT_EMAIL","");
  const logger=vi.spyOn(console,"error").mockImplementation(()=>{});
  const secret="private-patient-note-and-session-token";
  const error=Object.assign(new Error(secret),{digest:"123456"});
  await onRequestError(error,{path:"/patients/private-id?token="+secret,method:"POST",headers:{authorization:secret}},
    {routerKind:"App Router",routePath:"/patients/[id]",routeType:"action",renderSource:"react-server-components",revalidateReason:undefined});
  expect(logger.mock.calls).toEqual([["[voxa:request-error]",{reference:"123456",type:"action"}]]);
});
