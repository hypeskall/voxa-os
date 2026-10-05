import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient, User } from "@supabase/supabase-js";
vi.mock("server-only", () => ({}));
import { mfaRequired } from "../src/features/auth/mfa";
const assurance = vi.fn(), session = vi.fn();
const client = {auth:{getSession:session,mfa:{getAuthenticatorAssuranceLevel:assurance}}} as unknown as SupabaseClient;
const freshUser = (factors: {status:string}[] = []) => ({id:"verified-user",factors}) as User;
beforeEach(()=>{
  vi.clearAllMocks();
  session.mockResolvedValue({data:{session:{user:{id:"verified-user",factors:[]},access_token:"verified-token"}},error:null});
  assurance.mockResolvedValue({data:{currentLevel:"aal1",nextLevel:"aal1"},error:null});
});
describe("MFA reuses fresh Auth verification without trusting cookie factors",()=>{
  it("requires MFA enrolled elsewhere even when the cookie/SDK nextLevel is stale",async()=>{
    expect(await mfaRequired(client,freshUser([{status:"verified"}]))).toBe(true);
    expect(assurance).toHaveBeenCalledWith(undefined);
  });
  it("accepts AAL2 and ordinary accounts, ignoring obsolete cookie enrollment",async()=>{
    assurance.mockResolvedValue({data:{currentLevel:"aal1",nextLevel:"aal2"},error:null});
    expect(await mfaRequired(client,freshUser())).toBe(false);
    expect(await mfaRequired(client,freshUser([{status:"unverified"}]))).toBe(false);
    assurance.mockResolvedValue({data:{currentLevel:"aal2",nextLevel:"aal2"},error:null});
    expect(await mfaRequired(client,freshUser([{status:"verified"}]))).toBe(false);
  });
  it("still asks Auth for fresh factors when no verified user was supplied",async()=>{
    assurance.mockResolvedValue({data:{currentLevel:"aal1",nextLevel:"aal2"},error:null});
    expect(await mfaRequired(client)).toBe(true);
    expect(assurance).toHaveBeenCalledWith("verified-token");
  });
  it("fails closed on a missing session, mismatched user or assurance error",async()=>{
    await expect(mfaRequired(client,{id:"other-user"} as User)).rejects.toThrow();
    assurance.mockResolvedValue({data:null,error:new Error("unavailable")});
    await expect(mfaRequired(client,freshUser())).rejects.toThrow();
    session.mockResolvedValue({data:{session:null},error:null});
    await expect(mfaRequired(client,freshUser())).rejects.toThrow();
  });
});
