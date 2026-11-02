import { InvoiceDetailView } from "@/components/domain/invoice-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvoiceDetailView id={id} />;
}
