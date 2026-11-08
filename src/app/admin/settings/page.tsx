"use client";

import { AdminAccountEditor } from "@/components/domain/admin-account-form";
import { AdminDataPurge } from "@/components/domain/admin-data-purge";

export default function AdminSettingsPage() {
  return (
    <div className="grid gap-4">
      <AdminAccountEditor mode="settings" />
      <AdminDataPurge />
    </div>
  );
}
