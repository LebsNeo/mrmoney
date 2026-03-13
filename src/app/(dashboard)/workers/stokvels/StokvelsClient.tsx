"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/context/ToastContext";
import {
  addStokvelMember,
  createStokvel,
  recordStokvelContribution,
  removeStokvelMember,
} from "@/lib/actions/workers";

type Employee = {
  id: string;
  name: string;
};

type Stokvel = {
  id: string;
  name: string;
  description: string | null;
  monthlyAmount: number;
  totalBalance: number;
  payoutMonth: number | null;
  isActive: boolean;
  members: Array<{
    id: string;
    employee: Employee;
  }>;
  contributions: Array<{
    id: string;
    amount: number;
    period: string;
    paidAt: string | null;
    createdAt: string;
    employee: Employee;
  }>;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function StokvelsClient({
  employees,
  stokvels: initialStokvels,
}: {
  employees: Employee[];
  stokvels: Stokvel[];
}) {
  const router = useRouter();
  const stokvels = initialStokvels;
  const [isPending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const { showToast } = useToast();

  const [createForm, setCreateForm] = useState({
    name: "",
    monthlyAmount: "",
    payoutMonth: "",
  });

  const [memberSelections, setMemberSelections] = useState<Record<string, string>>({});
  const [contributionForms, setContributionForms] = useState<Record<string, { employeeId: string; amount: string; period: string }>>({});

  const now = new Date();
  const defaultPeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  function updateLocalContributionForm(stokvelId: string, patch: Partial<{ employeeId: string; amount: string; period: string }>) {
    setContributionForms((current) => ({
      ...current,
      [stokvelId]: {
        employeeId: current[stokvelId]?.employeeId ?? "",
        amount: current[stokvelId]?.amount ?? "",
        period: current[stokvelId]?.period ?? defaultPeriod,
        ...patch,
      },
    }));
  }

  function handleCreateStokvel() {
    setPendingKey("create");
    startTransition(async () => {
      const result = await createStokvel({
        name: createForm.name,
        monthlyAmount: parseFloat(createForm.monthlyAmount),
        payoutMonth: createForm.payoutMonth ? parseInt(createForm.payoutMonth, 10) : undefined,
      });
      setPendingKey(null);
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      showToast("Stokvel created.", "success");
      router.refresh();
    });
  }

  function handleAddMember(stokvelId: string) {
    const employeeId = memberSelections[stokvelId];
    if (!employeeId) {
      showToast("Select an employee first.", "warning");
      return;
    }

    setPendingKey(`member-add-${stokvelId}`);
    startTransition(async () => {
      const result = await addStokvelMember(stokvelId, employeeId);
      setPendingKey(null);
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      showToast("Member added.", "success");
      router.refresh();
    });
  }

  function handleRemoveMember(stokvelId: string, employeeId: string) {
    setPendingKey(`member-remove-${stokvelId}-${employeeId}`);
    startTransition(async () => {
      const result = await removeStokvelMember(stokvelId, employeeId);
      setPendingKey(null);
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      showToast("Member removed.", "success");
      router.refresh();
    });
  }

  function handleContribution(stokvelId: string) {
    const form = contributionForms[stokvelId] ?? { employeeId: "", amount: "", period: defaultPeriod };
    if (!form.employeeId || !form.amount || parseFloat(form.amount) <= 0) {
      showToast("Choose a member and enter a contribution amount.", "warning");
      return;
    }

    setPendingKey(`contribution-${stokvelId}`);
    startTransition(async () => {
      const result = await recordStokvelContribution({
        stokvelId,
        employeeId: form.employeeId,
        amount: parseFloat(form.amount),
        period: form.period,
      });
      setPendingKey(null);
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      showToast("Contribution recorded.", "success");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div>
            <p className="text-white font-semibold">Create Stokvel</p>
            <p className="text-xs text-gray-500">Set the group name, monthly amount, and payout month.</p>
          </div>
          <Link
            href="/workers"
            className="px-4 py-2 rounded-xl bg-gray-800 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
          >
            Back to Workers
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <input
            value={createForm.name}
            onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Name"
            className="rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={createForm.monthlyAmount}
            onChange={(event) => setCreateForm((current) => ({ ...current, monthlyAmount: event.target.value }))}
            placeholder="Monthly amount"
            className="rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
          />
          <select
            value={createForm.payoutMonth}
            onChange={(event) => setCreateForm((current) => ({ ...current, payoutMonth: event.target.value }))}
            className="rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
          >
            <option value="">Payout month</option>
            {MONTHS.map((month, index) => (
              <option key={month} value={index + 1}>
                {month}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCreateStokvel}
            disabled={isPending && pendingKey === "create"}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-400 disabled:opacity-50 transition-colors"
          >
            Create
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {stokvels.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center text-gray-500">
            No stokvels yet.
          </div>
        ) : (
          stokvels.map((stokvel) => {
            const memberIds = new Set(stokvel.members.map((member) => member.employee.id));
            const availableEmployees = employees.filter((employee) => !memberIds.has(employee.id));
            const contributionForm = contributionForms[stokvel.id] ?? { employeeId: "", amount: "", period: defaultPeriod };

            return (
              <div key={stokvel.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-white text-lg font-semibold">{stokvel.name}</p>
                    <p className="text-sm text-gray-500">
                      {formatCurrency(stokvel.monthlyAmount)} monthly
                      {stokvel.payoutMonth ? ` · Payout ${MONTHS[stokvel.payoutMonth - 1]}` : ""}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 min-w-[220px]">
                    <div>
                      <p className="text-xs text-gray-500">Balance</p>
                      <p className="text-emerald-400 font-semibold">{formatCurrency(stokvel.totalBalance)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Members</p>
                      <p className="text-white font-semibold">{stokvel.members.length}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white">Members</p>
                    </div>
                    <div className="space-y-2">
                      {stokvel.members.map((member) => (
                        <div key={member.id} className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-950 px-3 py-2">
                          <span className="text-sm text-gray-200">{member.employee.name}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(stokvel.id, member.employee.id)}
                            disabled={isPending && pendingKey === `member-remove-${stokvel.id}-${member.employee.id}`}
                            className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={memberSelections[stokvel.id] ?? ""}
                        onChange={(event) => setMemberSelections((current) => ({ ...current, [stokvel.id]: event.target.value }))}
                        className="flex-1 rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
                      >
                        <option value="">Add member</option>
                        {availableEmployees.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleAddMember(stokvel.id)}
                        disabled={availableEmployees.length === 0 || (isPending && pendingKey === `member-add-${stokvel.id}`)}
                        className="rounded-xl bg-gray-800 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 disabled:opacity-50 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium text-white">Record Contribution</p>
                    <div className="grid gap-2 md:grid-cols-3">
                      <select
                        value={contributionForm.employeeId}
                        onChange={(event) => updateLocalContributionForm(stokvel.id, { employeeId: event.target.value })}
                        className="rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
                      >
                        <option value="">Member</option>
                        {stokvel.members.map((member) => (
                          <option key={member.employee.id} value={member.employee.id}>
                            {member.employee.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={contributionForm.amount}
                        onChange={(event) => updateLocalContributionForm(stokvel.id, { amount: event.target.value })}
                        placeholder="Amount"
                        className="rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
                      />
                      <input
                        value={contributionForm.period}
                        onChange={(event) => updateLocalContributionForm(stokvel.id, { period: event.target.value })}
                        placeholder="2026-03"
                        className="rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleContribution(stokvel.id)}
                      disabled={isPending && pendingKey === `contribution-${stokvel.id}`}
                      className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-400 disabled:opacity-50 transition-colors"
                    >
                      Record Contribution
                    </button>

                    <div className="space-y-2 pt-2">
                      <p className="text-sm font-medium text-white">Recent Contributions</p>
                      {stokvel.contributions.length === 0 ? (
                        <p className="text-sm text-gray-500">No contributions recorded yet.</p>
                      ) : (
                        stokvel.contributions.map((contribution) => (
                          <div key={contribution.id} className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-950 px-3 py-2">
                            <div>
                              <p className="text-sm text-gray-200">{contribution.employee.name}</p>
                              <p className="text-xs text-gray-500">{contribution.period}</p>
                            </div>
                            <span className="text-sm font-semibold text-emerald-400">{formatCurrency(contribution.amount)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
