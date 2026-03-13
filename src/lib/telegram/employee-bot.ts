/**
 * MrCA — Telegram Employee Bot Helpers
 * Handles employee self-registration + payslip delivery via Telegram
 */

import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { sendMessage } from "./bot";

// ── Token management ──────────────────────────────────────────────────────────

export async function createEmployeeLinkToken(employeeId: string): Promise<string> {
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

  await prisma.employeeTelegramToken.create({
    data: { employeeId, token, expiresAt },
  });

  return token;
}

export function buildEmployeeLinkUrl(token: string): string {
  const botName = process.env.TELEGRAM_BOT_USERNAME ?? "mrca_staff_bot";
  return `https://t.me/${botName}?start=emp_${token}`;
}

// ── Link employee to Telegram chat ───────────────────────────────────────────

export async function linkEmployeeByToken(
  token: string,
  chatId: number
): Promise<{ ok: boolean; error?: string; employeeName?: string }> {
  const record = await prisma.employeeTelegramToken.findUnique({
    where: { token },
    include: { employee: true },
  });

  if (!record) return { ok: false, error: "Invalid link. Ask your manager to generate a new one." };
  if (record.usedAt) return { ok: false, error: "This link has already been used." };
  if (record.expiresAt < new Date()) return { ok: false, error: "This link has expired. Ask your manager for a new one." };

  // Check if this chat is already linked to another employee
  const existing = await prisma.employee.findFirst({
    where: { telegramChatId: String(chatId), deletedAt: null },
  });
  if (existing && existing.id !== record.employeeId) {
    return { ok: false, error: "This Telegram account is already linked to another employee." };
  }

  // Link it
  await prisma.employee.update({
    where: { id: record.employeeId },
    data: { telegramChatId: String(chatId), telegramOptIn: true },
  });

  await prisma.employeeTelegramToken.update({
    where: { token },
    data: { usedAt: new Date() },
  });

  return { ok: true, employeeName: record.employee.name };
}

// ── Get employee by Telegram chat ID ─────────────────────────────────────────

export async function getEmployeeByChatId(chatId: number | string) {
  return prisma.employee.findFirst({
    where: { telegramChatId: String(chatId), deletedAt: null, isActive: true },
    include: { organisation: true, property: true },
  });
}

// ── Send payslip via Telegram ─────────────────────────────────────────────────

export interface PayslipData {
  employeeName: string;
  propertyName: string;
  periodMonth: number;
  periodYear: number;
  grossPay: number;
  overtime: number;
  bonus: number;
  tips: number;
  uifEmployee: number;
  otherDeductions: number;
  netPay: number;
}

function monthName(m: number, y: number): string {
  return new Date(y, m - 1, 1).toLocaleString("en-ZA", { month: "long", year: "numeric" });
}

function R(n: number): string {
  return `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function buildPayslipMessage(data: PayslipData): string {
  const period = monthName(data.periodMonth, data.periodYear);
  const lines = [
    `💼 <b>MrCA Payslip — ${period}</b>`,
    `🏨 ${data.propertyName}`,
    ``,
    `<b>Employee:</b> ${data.employeeName}`,
    `<b>Period:</b> ${period}`,
    ``,
    `<b>Earnings</b>`,
    `Basic Salary:  ${R(data.grossPay)}`,
  ];
  if (data.overtime > 0) lines.push(`Overtime:      ${R(data.overtime)}`);
  if (data.bonus > 0) lines.push(`Bonus:         ${R(data.bonus)}`);
  if (data.tips > 0) lines.push(`Tips:          ${R(data.tips)}`);
  lines.push(``);
  lines.push(`<b>Deductions</b>`);
  lines.push(`UIF:           ${R(data.uifEmployee)}`);
  if (data.otherDeductions > 0) lines.push(`Other:         ${R(data.otherDeductions)}`);
  lines.push(``);
  lines.push(`<b>NET PAY:  ${R(data.netPay)}</b>`);
  lines.push(``);
  lines.push(`Questions? Reply to this message or contact your manager.`);

  return lines.join("\n");
}

export async function sendPayslipViaTelegram(
  telegramChatId: string,
  data: PayslipData
): Promise<{ ok: boolean; error?: string }> {
  try {
    const msg = buildPayslipMessage(data);
    await sendMessage(Number(telegramChatId), msg);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Failed to send Telegram message" };
  }
}
