import { setupDraft } from "./support/setup";
import { describe,it,expect } from "vitest";
import { registerSchema,resetSchema,safeAuthDestination } from "../src/features/auth/account-model";
import { draftSchema,validateSetup,validateStep } from "../src/features/onboarding/model";
describe("SaaS entry and setup validation",()=>{
 it("validates real email registration and matching strong passwords",()=>{
  const input={full_name:"Ana Popescu",email:"ana@example.ro",password:"A-strong-password-26",password_confirmation:"A-strong-password-26"};
  expect(registerSchema.safeParse(input).success).toBe(true);
  expect(registerSchema.safeParse({...input,password_confirmation:"wrong"}).success).toBe(false);
  expect(registerSchema.safeParse({...input,password:"short",password_confirmation:"short"}).success).toBe(false);
  expect(resetSchema.safeParse({password:input.password,password_confirmation:input.password}).success).toBe(true);
 });
 it("allows only known local authentication destinations",()=>{
  for(const path of ["//evil.test","/portal//evil","https://evil.test","/\\evil.test","/reset-password?next=//evil",null])expect(safeAuthDestination(path)).toBe("/");
  expect(safeAuthDestination("/portal")).toBe("/portal");
  expect(safeAuthDestination("/reset-password")).toBe("/reset-password");
  expect(safeAuthDestination(`/invitations/${"a".repeat(43)}`)).toContain("/invitations/");
 });
 it("accepts empty optional rooms/team and valid clinic configuration",()=>{expect(draftSchema.safeParse(setupDraft()).success).toBe(true);expect(validateSetup(setupDraft())).toBeNull();});
 it("requires real resources and checks links rather than accepting tenant IDs",()=>{
  const d=setupDraft();d.services=[];expect(validateSetup(d)).toContain("serviciu");
  const linked=setupDraft();linked.doctors[0].location_ids=["70000000-0000-4000-8000-000000000001"];expect(validateStep(linked,5)).not.toBeNull();
 });
 it("rejects closed weeks, invalid intervals, prices, missing doctors and duplicate invitations",()=>{
  const d=setupDraft();d.locations[0].hours=d.locations[0].hours.map(h=>({...h,closed:true}));expect(validateStep(d,3)).not.toBeNull();
  const invalidTime=setupDraft();invalidTime.locations[0].hours[0].start_time="08:99";expect(validateStep(invalidTime,3)).not.toBeNull();
  const p=setupDraft();p.services[0].price="NaN";expect(validateStep(p,4)).not.toBeNull();p.services[0].price="1.001";expect(validateStep(p,4)).not.toBeNull();
  const unassigned=setupDraft();unassigned.doctors[0].service_ids=[];expect(validateStep(unassigned,5)).not.toBeNull();
  const t=setupDraft();t.team=[{id:"80000000-0000-4000-8000-000000000001",location_id:t.locations[0].id,email:"admin@example.ro",role:"ADMIN"},{id:"80000000-0000-4000-8000-000000000002",location_id:t.locations[0].id,email:"ADMIN@example.ro",role:"DOCTOR"}];expect(validateStep(t,7)).not.toBeNull();
 });
});
