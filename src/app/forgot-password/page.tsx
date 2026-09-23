"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PublicHeader } from "@/components/layout/public-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { api, formatApiError } from "@/lib/api";
import { useI18n } from "@/i18n/provider";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [identifier, setIdentifier] = useState("");
  const [result, setResult] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const data = await api<{ sent: boolean; devToken?: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ identifier }),
      });
      setResult(data.devToken ? `/reset-password?token=${data.devToken}` : t.auth.sent);
      toast.success(t.auth.sent);
    } catch (error) {
      toast.error(formatApiError(error, t.common.error));
    }
  }

  return (
    <div>
      <PublicHeader />
      <main className="mx-auto max-w-md px-4 py-16">
        <Card>
          <h1 className="text-xl font-semibold">{t.auth.forgot}</h1>
          <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
            <Field label={t.auth.identifier}>
              <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
            </Field>
            <Button type="submit">{t.auth.submit}</Button>
          </form>
          {result ? <p className="mt-4 break-all text-sm text-muted">{result}</p> : null}
        </Card>
      </main>
    </div>
  );
}
