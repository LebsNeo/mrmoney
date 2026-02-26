import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PasswordChangeForm } from "./PasswordChangeForm";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

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

      {/* Password change */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-white font-semibold text-base mb-4">Change Password</h2>
        <PasswordChangeForm />
      </div>
    </div>
  );
}
