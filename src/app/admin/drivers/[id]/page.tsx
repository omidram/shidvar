import { DriverProfileView } from "@/components/domain/driver-profile-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DriverProfileView id={id} />;
}
