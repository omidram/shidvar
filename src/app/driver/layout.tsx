import type { ReactNode } from "react";
import { ApprovalGate } from "@/components/domain/approval-gate";
import { PortalShell } from "@/components/layout/portal-shell";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <PortalShell portal="driver">
      <ApprovalGate kind="driver">{children}</ApprovalGate>
    </PortalShell>
  );
}
