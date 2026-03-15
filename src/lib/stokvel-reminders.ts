/**
 * MrCA — Stokvel Contribution Reminders
 * Sends WhatsApp/Telegram reminders to members with outstanding contributions.
 */

import { prisma } from "@/lib/prisma";
import { sendMessage as sendTelegram } from "@/lib/telegram/bot";

function currentPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatRand(n: number): string {
  return `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Send contribution reminders to all members who haven't paid for the current period.
 * Called from cron or manually.
 */
export async function sendStokvelReminders(organisationId: string): Promise<{ sent: number; skipped: number }> {
  const period = currentPeriod();
  let sent = 0;
  let skipped = 0;

  const stokvels = await prisma.stokvel.findMany({
    where: { organisationId, isActive: true },
    include: {
      members: {
        where: { isActive: true },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              whatsappNumber: true,
              whatsappOptIn: true,
              telegramChatId: true,
              telegramOptIn: true,
            },
          },
        },
      },
      contributions: {
        where: { period },
        select: { employeeId: true },
      },
    },
  });

  for (const stokvel of stokvels) {
    const paidIds = new Set(stokvel.contributions.map(c => c.employeeId));
    const owingMembers = stokvel.members.filter(m => !paidIds.has(m.employee.id));

    for (const member of owingMembers) {
      const emp = member.employee;
      const amount = formatRand(Number(stokvel.monthlyAmount));
      const msg = `Hi ${emp.name.split(" ")[0]}, your ${stokvel.name} stokvel contribution of ${amount} for ${period} is outstanding. Please arrange payment or it will be deducted from your next payroll.`;

      try {
        // Send via Telegram if opted in
        if (emp.telegramChatId && emp.telegramOptIn) {
          await sendTelegram(Number(emp.telegramChatId), msg);
          sent++;
          continue; // Don't double-send
        }

        // WhatsApp sending would go here (via Meta/Twilio provider)
        // For now, just count as skipped if no Telegram
        skipped++;
      } catch {
        skipped++;
      }
    }
  }

  return { sent, skipped };
}

/**
 * Get stokvel payment status for an org — used in digest and dashboard.
 */
export async function getStokvelPaymentStatus(organisationId: string) {
  const period = currentPeriod();

  const stokvels = await prisma.stokvel.findMany({
    where: { organisationId, isActive: true },
    include: {
      members: {
        where: { isActive: true },
        include: { employee: { select: { id: true, name: true } } },
      },
      contributions: {
        where: { period },
        select: { employeeId: true, amount: true, paidAt: true },
      },
    },
  });

  return stokvels.map(s => {
    const paidIds = new Set(s.contributions.map(c => c.employeeId));
    return {
      id: s.id,
      name: s.name,
      type: s.type,
      monthlyAmount: Number(s.monthlyAmount),
      totalBalance: Number(s.totalBalance),
      memberCount: s.members.length,
      paidCount: paidIds.size,
      owingCount: s.members.length - paidIds.size,
      owingMembers: s.members
        .filter(m => !paidIds.has(m.employee.id))
        .map(m => m.employee.name),
    };
  });
}
