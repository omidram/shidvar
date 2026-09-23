import type { ReactNode } from "react";
import { PortalShell } from "@/components/layout/portal-shell";

export default function Layout({ children }: { children: ReactNode }) {
  return <PortalShell portal="supplier">{children}</PortalShell>;
}
