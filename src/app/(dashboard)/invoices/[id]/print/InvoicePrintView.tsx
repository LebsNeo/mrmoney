"use client";

import { useEffect } from "react";
import type { LineItem } from "@/lib/actions/invoices";

type InvoiceForPrint = {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: Date | string;
  dueDate: Date | string;
  subtotal: unknown;
  taxRate: unknown;
  taxAmount: unknown;
  totalAmount: unknown;
  clientName: string | null;
  clientEmail: string | null;
  lineItems: LineItem[] | null;
  notes: string | null;
  sentAt: Date | string | null;
  property: {
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
    checkIn: Date | string;
    checkOut: Date | string;
    room: { name: string } | null;
  } | null;
};

function n(v: unknown) { return Number(v) || 0; }

function getLineItems(invoice: InvoiceForPrint): LineItem[] {
  if (invoice.lineItems && Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0) {
    return invoice.lineItems as LineItem[];
  }
  if (invoice.booking) {
    const nights = Math.max(1, Math.round(
      (new Date(invoice.booking.checkOut).getTime() - new Date(invoice.booking.checkIn).getTime()) / 86400000
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

function fmt(d: Date | string) {
  return new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "long", year: "numeric" });
}

export function InvoicePrintView({ invoice, isPublic = false }: { invoice: InvoiceForPrint; isPublic?: boolean }) {
  const p = invoice.property;
  const lineItems = getLineItems(invoice);
  const subtotal = n(invoice.subtotal);
  const taxRate = n(invoice.taxRate);
  const taxAmount = n(invoice.taxAmount);
  const total = n(invoice.totalAmount);
  const footer = p.invoiceFooter || `Thank you for choosing ${p.name}. We look forward to welcoming you again!`;

  const clientName = invoice.clientName || invoice.booking?.guestName || null;
  const clientEmail = invoice.clientEmail || null;

  return (
    <>
      {/* Print-specific global styles */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #invoice-print-root { display: block !important; }
          #print-toolbar { display: none !important; }
          nav, aside, header { display: none !important; }
          .no-print { display: none !important; }
        }
        @page {
          size: A4;
          margin: 15mm 20mm;
        }
        #invoice-print-root {
          font-family: 'Inter', -apple-system, sans-serif;
          color: #111;
          background: white;
          max-width: 210mm;
          margin: 0 auto;
          padding: 8px;
        }
      `}</style>

      {/* Toolbar (hidden on print) */}
      <div id="print-toolbar" className="no-print fixed top-0 left-0 right-0 z-50 bg-gray-900 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!isPublic && (
            <>
              <a
                href={`/invoices/${invoice.id}`}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                ← Back to Invoice
              </a>
              <span className="text-gray-700">|</span>
            </>
          )}
          <span className="text-xs text-gray-400">
            Invoice {invoice.invoiceNumber}
          </span>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors"
        >
          🖨️ Print / Save as PDF
        </button>
      </div>

      {/* Invoice content */}
      <div id="invoice-print-root" style={{ paddingTop: "64px" }}>
        <div style={{
          background: "white",
          padding: "32px 40px",
          maxWidth: "760px",
          margin: "0 auto",
          borderRadius: "8px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
            <div>
              {p.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.logoUrl}
                  alt={p.name}
                  style={{ maxHeight: "72px", maxWidth: "180px", objectFit: "contain", marginBottom: "12px" }}
                />
              )}
              <h2 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 700, color: "#111" }}>{p.name}</h2>
              {p.address && <p style={{ margin: "0", fontSize: "13px", color: "#6b7280" }}>{p.address}</p>}
              {(p.suburb || p.city || p.postalCode) && (
                <p style={{ margin: "0", fontSize: "13px", color: "#6b7280" }}>
                  {[p.suburb, p.city, p.postalCode].filter(Boolean).join(", ")}
                </p>
              )}
              {p.phone && <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#6b7280" }}>{p.phone}</p>}
              {p.email && <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#6b7280" }}>{p.email}</p>}
              {p.website && <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#6b7280" }}>{p.website}</p>}
              {p.taxNumber && <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#6b7280" }}>VAT/Tax Reg No: <strong>{p.taxNumber}</strong></p>}
            </div>

            <div style={{ textAlign: "right" }}>
              <p style={{ margin: "0 0 2px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", color: "#9ca3af", textTransform: "uppercase" }}>Tax Invoice</p>
              <p style={{ margin: "0 0 8px", fontSize: "26px", fontWeight: 800, color: "#111" }}>{invoice.invoiceNumber}</p>
              <table style={{ fontSize: "13px", marginLeft: "auto" }}>
                <tbody>
                  <tr>
                    <td style={{ color: "#6b7280", paddingRight: "12px", paddingBottom: "2px" }}>Issue Date</td>
                    <td style={{ fontWeight: 600 }}>{fmt(invoice.issueDate)}</td>
                  </tr>
                  <tr>
                    <td style={{ color: "#6b7280", paddingRight: "12px" }}>Due Date</td>
                    <td style={{ fontWeight: 600 }}>{fmt(invoice.dueDate)}</td>
                  </tr>
                  <tr>
                    <td style={{ color: "#6b7280", paddingRight: "12px", paddingTop: "4px" }}>Status</td>
                    <td style={{ fontWeight: 600, color: invoice.status === "PAID" ? "#10b981" : "#f59e0b", paddingTop: "4px" }}>
                      {invoice.status}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: "2px solid #10b981", marginBottom: "24px" }} />

          {/* Bill To — only show if we have client info */}
          {(clientName || clientEmail) && (
            <div style={{ marginBottom: "24px" }}>
              <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", color: "#9ca3af", textTransform: "uppercase" }}>Bill To</p>
              {clientName && <p style={{ margin: "0", fontWeight: 600, fontSize: "15px" }}>{clientName}</p>}
              {clientEmail && <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#6b7280" }}>{clientEmail}</p>}
              {invoice.booking && (
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>
                  Stay: {fmt(invoice.booking.checkIn)} → {fmt(invoice.booking.checkOut)}
                  {invoice.booking.room ? ` · ${invoice.booking.room.name}` : ""}
                </p>
              )}
            </div>
          )}

          {/* Line items table */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "0" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ textAlign: "left", padding: "10px 12px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", color: "#6b7280", textTransform: "uppercase" }}>Description</th>
                <th style={{ textAlign: "center", padding: "10px 12px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", color: "#6b7280", textTransform: "uppercase" }}>Qty</th>
                <th style={{ textAlign: "right", padding: "10px 12px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", color: "#6b7280", textTransform: "uppercase" }}>Unit Price</th>
                <th style={{ textAlign: "right", padding: "10px 12px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", color: "#6b7280", textTransform: "uppercase" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "12px", fontSize: "14px" }}>{item.description}</td>
                  <td style={{ padding: "12px", fontSize: "14px", textAlign: "center", color: "#6b7280" }}>{item.qty}</td>
                  <td style={{ padding: "12px", fontSize: "14px", textAlign: "right", color: "#6b7280" }}>R {Number(item.unitPrice).toFixed(2)}</td>
                  <td style={{ padding: "12px", fontSize: "14px", textAlign: "right", fontWeight: 600 }}>R {Number(item.amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "12px", marginBottom: "28px" }}>
            <div style={{ maxWidth: "240px", marginLeft: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#6b7280", marginBottom: "6px" }}>
                <span>Subtotal</span>
                <span>R {subtotal.toFixed(2)}</span>
              </div>
              {taxAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#6b7280", marginBottom: "6px" }}>
                  <span>VAT ({(taxRate * 100).toFixed(0)}%)</span>
                  <span>R {taxAmount.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "16px", fontWeight: 800, borderTop: "2px solid #111", paddingTop: "8px", marginTop: "8px" }}>
                <span>Total Due</span>
                <span>R {total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Payment details — only if bank info set */}
          {p.bankName && (
            <div style={{ background: "#f9fafb", borderRadius: "8px", padding: "14px 16px", marginBottom: "24px" }}>
              <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", color: "#6b7280", textTransform: "uppercase" }}>Payment Details</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px", fontSize: "13px" }}>
                <span style={{ color: "#6b7280" }}>Bank</span><span style={{ fontWeight: 600 }}>{p.bankName}</span>
                {p.bankAccount && <><span style={{ color: "#6b7280" }}>Account No</span><span style={{ fontWeight: 600 }}>{p.bankAccount}</span></>}
                {p.bankBranch && <><span style={{ color: "#6b7280" }}>Branch Code</span><span style={{ fontWeight: 600 }}>{p.bankBranch}</span></>}
                <span style={{ color: "#6b7280" }}>Reference</span><span style={{ fontWeight: 600 }}>{invoice.invoiceNumber}</span>
              </div>
            </div>
          )}

          {/* Notes — only if set */}
          {invoice.notes && (
            <div style={{ marginBottom: "24px", fontSize: "13px", color: "#374151" }}>
              <strong>Notes:</strong> {invoice.notes}
            </div>
          )}

          {/* Footer divider */}
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "20px", marginTop: "8px" }}>
            <p style={{ margin: "0", fontSize: "14px", color: "#374151", fontStyle: "italic", textAlign: "center" }}>
              {footer}
            </p>
            <p style={{ margin: "12px 0 0", fontSize: "11px", color: "#9ca3af", textAlign: "center" }}>
              This is a computer-generated document. No signature is required.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
