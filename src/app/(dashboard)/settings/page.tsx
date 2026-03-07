import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PasswordChangeForm } from "./PasswordChangeForm";
import { FinancePinSettings } from "@/components/FinancePinSettings";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  const orgId = user?.organisationId as string | undefined;

  // Check if finance PIN is set
  let hasPin = false;
  if (orgId) {
    try {
      const org = await prisma.$queryRaw<Array<{ financePin: string | null }>>`
        SELECT "financePin" FROM organisations WHERE id = ${orgId}
      `;
      hasPin = !!org[0]?.financePin;
    } catch { /* ignore */ }
  }

  const name = user?.name ?? "—";
  const email = user?.email ?? "—";
  const orgName = user?.organisationName ?? "—";
  const role = user?.role ?? "—";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader title="Settings" description="Manage your profile and account" />

      {/* Profile section */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-semibold text-base">Profile</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-800">
            <span className="text-sm text-gray-400">Name</span>
            <span className="text-sm text-white font-medium">{name}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-800">
            <span className="text-sm text-gray-400">Email</span>
            <span className="text-sm text-white font-medium">{email}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-400">Role</span>
            <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full">
              {role}
            </span>
          </div>
        </div>
      </div>

      {/* Organisation section */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-semibold text-base">Organisation</h2>
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-gray-400">Organisation name</span>
          <span className="text-sm text-white font-medium">{orgName}</span>
        </div>
      </div>

      {/* WhatsApp */}
      <Link href="/settings/whatsapp" className="block">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex items-center justify-between hover:border-gray-700 transition-colors">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💬</span>
            <div>
              <h2 className="text-white font-semibold text-base">WhatsApp Connection</h2>
              <p className="text-xs text-gray-500">Connect your business WhatsApp number</p>
            </div>
          </div>
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </Link>

      {/* Finance PIN */}
      <FinancePinSettings hasPin={hasPin} />

      {/* Password change */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-white font-semibold text-base mb-4">Change Password</h2>
        <PasswordChangeForm />
      </div>
    </div>
  );
}
