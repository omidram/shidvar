import { DriverJobView } from "@/components/domain/workspaces";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DriverJobView id={id} />;
}
