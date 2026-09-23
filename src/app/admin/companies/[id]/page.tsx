import { CompanyProfileView } from "@/components/domain/company-profile-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CompanyProfileView id={id} />;
}
