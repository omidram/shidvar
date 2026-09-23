import { DisputeDetailView } from "@/components/domain/ops-pages";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DisputeDetailView id={id} />;
}
