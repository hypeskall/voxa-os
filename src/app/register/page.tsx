import { AccountPage } from "@/features/auth/account-page";
import { safeAuthDestination } from "@/features/auth/account-model";
export const metadata = { title: "Înregistrare" };
export default async function Register({ searchParams }: { searchParams: Promise<{ next?: string }> }) { const search = await searchParams; return <AccountPage mode="register" next={safeAuthDestination(search.next ?? "/")}/>; }
