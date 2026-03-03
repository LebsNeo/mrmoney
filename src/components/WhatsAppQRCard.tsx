"use client";

import { useState, useRef } from "react";

interface Props {
  propertyId: string;
  propertyName: string;
}

interface QRData {
  qrDataUrl: string;
  waUrl: string;
  propertyName: string;
  waNumber: string;
}

export function WhatsAppQRCard({ propertyId, propertyName }: Props) {
  const [qrData, setQrData] = useState<QRData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/properties/${propertyId}/whatsapp-qr`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setQrData(data);
      setShowCard(true);
    } catch {
      alert("Failed to generate QR code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadCard() {
    if (!cardRef.current || !qrData) return;

    // Dynamically import html2canvas only when needed
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: null,
      scale: 3, // high-res for print
      useCORS: true,
    });

    const link = document.createElement("a");
    link.download = `${qrData.propertyName.replace(/\s+/g, "-")}-WhatsApp-QR.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function printCard() {
    if (!cardRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${qrData?.propertyName} — WhatsApp QR</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              display: flex; align-items: center; justify-content: center;
              min-height: 100vh; background: #fff;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
          </style>
        </head>
        <body>${cardRef.current.outerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  }

  return (
    <div>
      {!showCard ? (
        <button
          onClick={generate}
          disabled={loading}
          className="btn-primary !bg-transparent"
        >
          <span className="text-base">📲</span>
          {loading ? "Generating..." : "Generate WhatsApp QR Code"}
        </button>
      ) : (
        <div className="space-y-4">
          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={downloadCard}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-sm font-medium"
            >
              ⬇ Download PNG
            </button>
            <button
              onClick={printCard}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition-colors text-sm font-medium"
            >
              🖨 Print
            </button>
            <button
              onClick={() => setShowCard(false)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 border border-gray-700 text-gray-500 hover:text-gray-300 transition-colors text-sm font-medium"
            >
              ✕ Close
            </button>
          </div>

          {/* The printable card */}
          <div
            ref={cardRef}
            style={{
              width: "340px",
              background: "linear-gradient(135deg, #0a0f1e 0%, #0d1f14 50%, #0a0f1e 100%)",
              borderRadius: "20px",
              padding: "32px 28px",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 32px 64px rgba(0,0,0,0.4)",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Decorative glow */}
            <div style={{
              position: "absolute", top: "-60px", right: "-60px",
              width: "180px", height: "180px",
              background: "radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)",
              borderRadius: "50%",
            }} />
            <div style={{
              position: "absolute", bottom: "-40px", left: "-40px",
              width: "140px", height: "140px",
              background: "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)",
              borderRadius: "50%",
            }} />

            {/* Header */}
            <div style={{ marginBottom: "20px", position: "relative" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px"
              }}>
                <div style={{
                  width: "32px", height: "32px", borderRadius: "8px",
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "16px",
                }}>💚</div>
                <span style={{ color: "#10b981", fontSize: "13px", fontWeight: "700", letterSpacing: "0.05em" }}>
                  MrCA
                </span>
              </div>
              <h2 style={{
                color: "#ffffff", fontSize: "20px", fontWeight: "800",
                lineHeight: "1.2", margin: 0,
              }}>
                {qrData?.propertyName}
              </h2>
              <p style={{ color: "#6ee7b7", fontSize: "13px", marginTop: "4px", fontWeight: "500" }}>
                Book your stay via WhatsApp
              </p>
            </div>

            {/* QR code */}
            <div style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "16px",
              display: "inline-block",
              marginBottom: "20px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrData?.qrDataUrl}
                alt="WhatsApp QR Code"
                style={{ width: "180px", height: "180px", display: "block" }}
              />
            </div>

            {/* Instructions */}
            <div style={{ position: "relative" }}>
              <div style={{
                display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "12px",
              }}>
                <div style={{
                  width: "24px", height: "24px", borderRadius: "50%",
                  background: "rgba(16,185,129,0.15)",
                  border: "1px solid rgba(16,185,129,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "12px", fontWeight: "700", color: "#10b981",
                  flexShrink: 0, marginTop: "1px",
                }}>1</div>
                <p style={{ color: "#d1fae5", fontSize: "13px", margin: 0, lineHeight: "1.4" }}>
                  Open WhatsApp on your phone
                </p>
              </div>
              <div style={{
                display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "12px",
              }}>
                <div style={{
                  width: "24px", height: "24px", borderRadius: "50%",
                  background: "rgba(16,185,129,0.15)",
                  border: "1px solid rgba(16,185,129,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "12px", fontWeight: "700", color: "#10b981",
                  flexShrink: 0, marginTop: "1px",
                }}>2</div>
                <p style={{ color: "#d1fae5", fontSize: "13px", margin: 0, lineHeight: "1.4" }}>
                  Tap <strong style={{ color: "#fff" }}>Scan QR Code</strong> or use your camera
                </p>
              </div>
              <div style={{
                display: "flex", alignItems: "flex-start", gap: "10px",
              }}>
                <div style={{
                  width: "24px", height: "24px", borderRadius: "50%",
                  background: "rgba(16,185,129,0.15)",
                  border: "1px solid rgba(16,185,129,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "12px", fontWeight: "700", color: "#10b981",
                  flexShrink: 0, marginTop: "1px",
                }}>3</div>
                <p style={{ color: "#d1fae5", fontSize: "13px", margin: 0, lineHeight: "1.4" }}>
                  Send the message and our assistant will help you book instantly
                </p>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              marginTop: "20px", paddingTop: "16px",
              borderTop: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ color: "#4b5563", fontSize: "11px" }}>
                Powered by <span style={{ color: "#10b981" }}>mrca.co.za</span>
              </span>
              <div style={{
                background: "rgba(37,211,102,0.15)",
                border: "1px solid rgba(37,211,102,0.3)",
                borderRadius: "20px", padding: "3px 10px",
                display: "flex", alignItems: "center", gap: "5px",
              }}>
                <span style={{ fontSize: "12px" }}>📱</span>
                <span style={{ color: "#25d366", fontSize: "11px", fontWeight: "600" }}>WhatsApp</span>
              </div>
            </div>
          </div>

          {/* Helper text */}
          <p className="text-xs text-gray-600">
            💡 Print this card and place it at your reception desk, rooms, or share it digitally with guests.
          </p>
        </div>
      )}
    </div>
  );
}
