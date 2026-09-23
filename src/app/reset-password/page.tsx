"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { PublicHeader } from "@/components/layout/public-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { api, formatApiError } from "@/lib/api";
import { useI18n } from "@/i18n/provider";

function ResetForm() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const token = params.get("token") ?? "";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });
      toast.success(t.auth.loginTitle);
      router.replace("/login");
    } catch (error) {
      toast.error(formatApiError(error, t.common.error));
    }
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold">{t.auth.resetTitle}</h1>
      <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
        <Field label={t.auth.password} hint={t.auth.passwordHint}>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Button type="submit" disabled={!token}>
          {t.auth.submit}
        </Button>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div>
      <PublicHeader />
      <main className="mx-auto max-w-md px-4 py-16">
        <Suspense>
          <ResetForm />
        </Suspense>
      </main>
    </div>
  );
}
