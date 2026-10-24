import type { ReactNode } from "react";
import { redirect } from "next/navigation";

export default function Layout({ children }: { children: ReactNode }) {
  void children;
  redirect("/requester/dashboard");
}
