import type { ReactNode } from "react";
import { ApprovalGate } from "@/components/domain/approval-gate";
import { PortalShell } from "@/components/layout/portal-shell";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <PortalShell portal="requester">
      <ApprovalGate kind="requester">{children}</ApprovalGate>
    </PortalShell>
  );
}
