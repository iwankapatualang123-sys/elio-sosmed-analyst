// File: components/PrintButton.jsx
// Tombol cetak/simpan-PDF (client) — memicu dialog print browser (Simpan sebagai PDF).

"use client";

import Button from "@/components/Button";

export default function PrintButton() {
  return (
    <Button variant="primary" onClick={() => window.print()} className="no-print">
      🖨️ Cetak / Simpan PDF
    </Button>
  );
}
