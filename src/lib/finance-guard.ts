import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verify } from "@/lib/finance-token";

export async function requireFinanceAccess(returnTo: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("finance_unlocked")?.value;
  if (token && verify(token)) return; // unlocked
  redirect(`/finance-lock?returnTo=${encodeURIComponent(returnTo)}`);
}
