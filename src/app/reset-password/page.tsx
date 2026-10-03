import { AccountPage } from "@/features/auth/account-page";
import { requireUser } from "@/features/auth/access";
export const metadata = { title: "Parolă nouă" };
export default async function Reset() { await requireUser(); return <AccountPage mode="reset"/>; }
