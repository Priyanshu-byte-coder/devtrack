"use client";

import { Printer } from "lucide-react";

export default function ExportPdfButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden secondary-button inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold"
    >
      <Printer className="h-4 w-4" />
      Export to PDF
    </button>
  );
}
