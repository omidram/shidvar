import { Suspense } from "react";
import { PrintDocumentPage } from "@/components/domain/print-document";

export default async function Page({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  return (
    <Suspense fallback={<p className="p-8">در حال آماده‌سازی سند…</p>}>
      <PrintDocumentPage kind={kind} id={id} />
    </Suspense>
  );
}
