"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateInvoice, sendInvoiceEmail, LineItem } from "@/lib/actions/invoices";
import { markInvoicePaid } from "@/lib/actions/invoices";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency } from "@/lib/utils";
import { PaymentMethod } from "@prisma/client";

// Type for the enriched invoice object from getInvoiceById
type InvoiceWithRelations = {
  id: string;
  invoiceNumber: string;
  status: string;
  effectiveStatus: string;
  issueDate: Date | string;
  dueDate: Date | string;
  subtotal: number | string | object;
  taxRate: number | string | object;
  taxAmount: number | string | object;
  totalAmount: number | string | object;
  clientName: string | null;
  clientEmail: string | null;
  lineItems: LineItem[] | null;
  notes: string | null;
  sentAt: Date | string | null;
  property: {
    id: string;
    name: string;
    address: string | null;
    suburb: string | null;
    city: string | null;
    postalCode: string | null;
    phone: string | null;
    email: string | null;
    taxNumber: string | null;
    logoUrl: string | null;
    website: string | null;
    bankName: string | null;
    bankAccount: string | null;
    bankBranch: string | null;
    invoiceFooter: string | null;
  };
  booking: {
    guestName: string;
    guestEmail?: string | null;
    checkIn: Date | string;
    checkOut: Date | string;
    room: { name: string } | null;
  } | null;
};

function n(v: unknown) { return Number(v) || 0; }

function defaultLineItems(invoice: InvoiceWithRelations): LineItem[] {
  if (invoice.lineItems && Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0) {
    return invoice.lineItems as LineItem[];
  }
  // Auto-generate from booking if available
  if (invoice.booking) {
    const nights =
      Math.max(1, Math.round(
        (new Date(invoice.booking.checkOut).getTime() - new Date(invoice.booking.checkIn).getTime()) /
        86400000
      ));
    const unitPrice = n(invoice.subtotal) / (nights || 1);
    return [{
      description: `Accommodation — ${invoice.booking.room?.name ?? "Room"} (${nights} night${nights !== 1 ? "s" : ""})`,
      qty: nights,
      unitPrice: Math.round(unitPrice * 100) / 100,
      amount: n(invoice.subtotal),
    }];
  }
  return [{ description: "Accommodation", qty: 1, unitPrice: n(invoice.subtotal), amount: n(invoice.subtotal) }];
}

export function InvoiceDetailClient({ invoice }: { invoice: InvoiceWithRelations }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Edit state
  const [clientName, setClientName] = useState(
    invoice.clientName || invoice.booking?.guestName || ""
  );
  const [clientEmail, setClientEmail] = useState(
    invoice.clientEmail || (invoice.booking as any)?.guestEmail || ""
  );
  const [lineItems, setLineItems] = useState<LineItem[]>(defaultLineItems(invoice));
  const [notes, setNotes] = useState(invoice.notes || "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("EFT");
  const [paymentRef, setPaymentRef] = useState("");

  const isPaid = invoice.status === "PAID";
  const isCancelled = invoice.status === "CANCELLED";
  const canEdit = !isPaid && !isCancelled;
  const canSend = !isCancelled; // PAID invoices still sendable as tax receipts

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  // Line item helpers
  function updateItem(i: number, field: keyof LineItem, raw: string) {
    setLineItems(prev => {
      const next = [...prev];
      const val = parseFloat(raw) || 0;
      next[i] = { ...next[i], [field]: field === "description" ? raw : val };
      if (field === "qty" || field === "unitPrice") {
        next[i].amount = Math.round(next[i].qty * next[i].unitPrice * 100) / 100;
      }
      return next;
    });
  }
  function addItem() {
    setLineItems(prev => [...prev, { description: "", qty: 1, unitPrice: 0, amount: 0 }]);
  }
  function removeItem(i: number) {
    setLineItems(prev => prev.filter((_, idx) => idx !== i));
  }

  const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);
  const taxRate = n(invoice.taxRate);
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  async function handleSave() {
    setSaving(true);
    const res = await updateInvoice(invoice.id, {
      clientName: clientName || undefined,
      clientEmail: clientEmail || undefined,
      lineItems,
      notes: notes || undefined,
    });
    setSaving(false);
    showToast(res.message, res.success);
    if (res.success) {
      setEditing(false);
      router.refresh();
    }
  }

  async function handleSend() {
    if (!clientEmail) {
      showToast("Please add a client email address first (click Edit)", false);
      return;
    }
    if (!confirm(`Send invoice ${invoice.invoiceNumber} to ${clientEmail}?`)) return;
    setSending(true);
    const res = await sendInvoiceEmail(invoice.id);
    setSending(false);
    showToast(res.message, res.success);
    if (res.success) router.refresh();
  }

  async function handleMarkPaid() {
    if (!paymentRef.trim()) {
      showToast("Please enter a payment reference", false);
      return;
    }
    setPaying(true);
    const res = await markInvoicePaid(invoice.id, paymentMethod, paymentRef);
    setPaying(false);
    showToast(res.message, res.success);
    if (res.success) router.refresh();
  }

  const displayClientName = invoice.clientName || invoice.booking?.guestName || "—";
  const displayClientEmail = invoice.clientEmail || (invoice.booking as any)?.guestEmail || null;

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg border transition-all ${
          toast.ok
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            : "bg-red-500/10 border-red-500/30 text-red-400"
        }`}>
          {toast.ok ? "✅" : "❌"} {toast.msg}
        </div>
      )}

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <StatusBadge status={invoice.effectiveStatus.toLowerCase()} />
        {invoice.sentAt && (
          <span className="text-xs text-gray-500">
            Sent {new Date(invoice.sentAt).toLocaleDateString("en-ZA")}
          </span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {canEdit && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 rounded-xl text-xs bg-gray-800 border border-gray-700 text-gray-300 hover:text-white transition-colors"
            >
              ✏️ Edit
            </button>
          )}
          <a
            href={`/invoices/${invoice.id}/print`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-xl text-xs bg-gray-800 border border-gray-700 text-gray-300 hover:text-white transition-colors"
          >
            🖨️ Print / PDF
          </a>
          {canSend && (
            <button
              onClick={handleSend}
              disabled={sending}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
            >
              {sending ? "Sending..." : isPaid ? "✉️ Send Tax Receipt" : "✉️ Send to Client"}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main invoice panel */}
        <div className="lg:col-span-2 space-y-4">

          {/* Client info */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Client Details
            </h3>
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Client Name</label>
                  <input
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    placeholder="Guest / company name"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Client Email <span className="text-emerald-400">*</span>
                    <span className="text-gray-500 ml-1">(required to send)</span>
                  </label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={e => setClientEmail(e.target.value)}
                    placeholder="guest@example.com"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-white font-medium">{displayClientName}</p>
                {displayClientEmail ? (
                  <p className="text-sm text-gray-400">{displayClientEmail}</p>
                ) : (
                  <p className="text-xs text-amber-400">
                    ⚠ No email — click Edit to add one before sending
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Line items */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Line Items
              </h3>
            </div>

            {editing ? (
              <div className="p-4 space-y-2">
                {lineItems.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      value={item.description}
                      onChange={e => updateItem(i, "description", e.target.value)}
                      placeholder="Description"
                      className="col-span-5 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <input
                      type="number"
                      value={item.qty}
                      onChange={e => updateItem(i, "qty", e.target.value)}
                      min={1}
                      className="col-span-2 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white text-center focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <input
                      type="number"
                      value={item.unitPrice}
                      onChange={e => updateItem(i, "unitPrice", e.target.value)}
                      step="0.01"
                      className="col-span-2 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white text-right focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="col-span-2 text-xs text-right text-emerald-400 font-medium">
                      R{item.amount.toFixed(2)}
                    </span>
                    <button
                      onClick={() => removeItem(i)}
                      className="col-span-1 text-red-500 hover:text-red-400 text-lg leading-none text-center"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div className="grid grid-cols-12 gap-2 mb-1">
                  <span className="col-span-5 text-[10px] text-gray-600 pl-1">Description</span>
                  <span className="col-span-2 text-[10px] text-gray-600 text-center">Qty</span>
                  <span className="col-span-2 text-[10px] text-gray-600 text-right">Unit Price</span>
                  <span className="col-span-2 text-[10px] text-gray-600 text-right">Amount</span>
                </div>
                <button
                  onClick={addItem}
                  className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  + Add line item
                </button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Description</th>
                    <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-500">Qty</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">Unit Price</th>
                    <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {lineItems.map((item, i) => (
                    <tr key={i}>
                      <td className="px-5 py-3 text-sm text-white">{item.description || "—"}</td>
                      <td className="px-3 py-3 text-sm text-gray-400 text-center">{item.qty}</td>
                      <td className="px-3 py-3 text-sm text-gray-400 text-right">R{Number(item.unitPrice).toFixed(2)}</td>
                      <td className="px-5 py-3 text-sm text-white text-right font-medium">R{Number(item.amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Totals */}
            <div className="border-t border-gray-800 px-5 py-4 space-y-1.5">
              <div className="flex justify-between text-sm text-gray-400">
                <span>Subtotal</span>
                <span>R{(editing ? subtotal : n(invoice.subtotal)).toFixed(2)}</span>
              </div>
              {(editing ? taxAmount > 0 : n(invoice.taxAmount) > 0) && (
                <div className="flex justify-between text-sm text-gray-400">
                  <span>VAT ({((editing ? taxRate : n(invoice.taxRate)) * 100).toFixed(0)}%)</span>
                  <span>R{(editing ? taxAmount : n(invoice.taxAmount)).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-white pt-1.5 border-t border-gray-700">
                <span>Total</span>
                <span>R{(editing ? total : n(invoice.totalAmount)).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Notes</h3>
            {editing ? (
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Any additional notes for the client..."
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            ) : (
              <p className="text-sm text-gray-300">{invoice.notes || <span className="text-gray-600 italic">No notes</span>}</p>
            )}
          </div>

          {/* Save / Cancel buttons when editing */}
          {editing && (
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 rounded-xl text-sm bg-gray-800 border border-gray-700 text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Invoice"}
              </button>
            </div>
          )}
        </div>

        {/* Right column — Property info + Mark Paid */}
        <div className="space-y-4">

          {/* Invoice metadata */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Invoice Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Number</span>
                <span className="text-white font-mono">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Issued</span>
                <span className="text-gray-300">{new Date(invoice.issueDate).toLocaleDateString("en-ZA")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Due</span>
                <span className="text-gray-300">{new Date(invoice.dueDate).toLocaleDateString("en-ZA")}</span>
              </div>
              {invoice.booking && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Check-in</span>
                    <span className="text-gray-300">{new Date(invoice.booking.checkIn).toLocaleDateString("en-ZA")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Check-out</span>
                    <span className="text-gray-300">{new Date(invoice.booking.checkOut).toLocaleDateString("en-ZA")}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Property billing profile (read-only) */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">From</h3>
              <a href="/properties" className="text-[10px] text-emerald-400 hover:text-emerald-300">Edit Profile →</a>
            </div>
            {invoice.property.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={invoice.property.logoUrl}
                alt={invoice.property.name}
                className="max-h-12 max-w-[140px] object-contain mb-3"
              />
            )}
            <div className="space-y-1 text-sm">
              <p className="text-white font-semibold">{invoice.property.name}</p>
              {invoice.property.address && (
                <p className="text-gray-400 text-xs">{invoice.property.address}</p>
              )}
              {(invoice.property.suburb || invoice.property.city || invoice.property.postalCode) && (
                <p className="text-gray-400 text-xs">
                  {[invoice.property.suburb, invoice.property.city, invoice.property.postalCode].filter(Boolean).join(", ")}
                </p>
              )}
              {invoice.property.phone && <p className="text-gray-400 text-xs">📞 {invoice.property.phone}</p>}
              {invoice.property.email && <p className="text-gray-400 text-xs">✉ {invoice.property.email}</p>}
              {invoice.property.taxNumber && <p className="text-gray-400 text-xs">VAT/Tax: {invoice.property.taxNumber}</p>}
              {invoice.property.bankName && (
                <div className="mt-2 pt-2 border-t border-gray-800">
                  <p className="text-gray-500 text-[10px] uppercase mb-1">Bank</p>
                  <p className="text-gray-400 text-xs">{invoice.property.bankName}</p>
                  {invoice.property.bankAccount && <p className="text-gray-400 text-xs">Acc: {invoice.property.bankAccount}</p>}
                  {invoice.property.bankBranch && <p className="text-gray-400 text-xs">Branch: {invoice.property.bankBranch}</p>}
                </div>
              )}
            </div>
            {!invoice.property.phone && !invoice.property.email && !invoice.property.taxNumber && (
              <p className="text-xs text-amber-400 mt-2">
                ⚠ Billing profile incomplete —{" "}
                <a href="/properties" className="underline">add details</a>
              </p>
            )}
          </div>

          {/* Mark as Paid */}
          {!isPaid && !isCancelled && invoice.effectiveStatus !== "DRAFT" && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Mark as Paid</h3>
              <div className="space-y-2">
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {Object.values(PaymentMethod).map(m => (
                    <option key={m} value={m}>{m.replace(/_/g, " ")}</option>
                  ))}
                </select>
                <input
                  value={paymentRef}
                  onChange={e => setPaymentRef(e.target.value)}
                  placeholder="Payment reference / proof number"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={handleMarkPaid}
                  disabled={paying}
                  className="w-full py-2 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors disabled:opacity-50"
                >
                  {paying ? "Processing..." : "✓ Mark as Paid"}
                </button>
              </div>
            </div>
          )}

          {isPaid && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4">
              <p className="text-sm text-emerald-400 font-semibold">✅ Invoice Paid</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
