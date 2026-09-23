"use client";

import { Button } from "@/components/ui/button";

export function PdfExportButton({ kind, id, label }: { kind: "invoice" | "waybill" | "request"; id: string; label: string }) {
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={() => window.open(`/print/${kind}/${id}?auto=1`, "_blank", "noopener")}
    >
      {label}
    </Button>
  );
}
