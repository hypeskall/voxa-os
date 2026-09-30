import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/server";
export async function GET(request:Request){const url=new URL(request.url);const code=url.searchParams.get("code");const requested=url.searchParams.get("next")??"/portal";const next=requested.startsWith("/portal")?requested:"/portal";if(code){const client=await db();const {error}=await client.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(next,url.origin));}return NextResponse.redirect(new URL("/portal/login?error=link",url.origin));}
