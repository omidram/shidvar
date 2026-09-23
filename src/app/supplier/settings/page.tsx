"use client";

import { useState } from "react";
import { PageHeader } from "@/components/domain/chrome";
import { Card } from "@/components/ui/card";
import { statusFa } from "@/lib/status-fa";
import { useI18n } from "@/i18n/provider";
import { useMe } from "@/hooks/use-me";

export default function SettingsPage() {
  const { t } = useI18n();
  const me = useMe();
  const [autoOffer, setAutoOffer] = useState(false);
  const [notifyMatch, setNotifyMatch] = useState(true);
  return (
    <div className="grid gap-4">
      <PageHeader title={t.menu.settings} description="ترجیح بازار و اعلان تطبیق" />
      <Card>
        <h2 className="font-bold">حساب تأمین‌کننده</h2>
        <p className="mt-2 text-lg">{me.data?.firstName} {me.data?.lastName}</p>
        <p className="mt-1 text-sm text-muted">{statusFa(me.data?.memberships[0]?.companyStatus)}</p>
      </Card>
      <Card className="grid gap-3">
        <label className="flex items-center justify-between rounded-2xl bg-background px-4 py-3 text-sm">
          اعلان درخواست منطبق
          <input type="checkbox" checked={notifyMatch} onChange={(e) => setNotifyMatch(e.target.checked)} />
        </label>
        <label className="flex items-center justify-between rounded-2xl bg-background px-4 py-3 text-sm">
          پیشنهاد پیش‌نویس خودکار
          <input type="checkbox" checked={autoOffer} onChange={(e) => setAutoOffer(e.target.checked)} />
        </label>
      </Card>
    </div>
  );
}
