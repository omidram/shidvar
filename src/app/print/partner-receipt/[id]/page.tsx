"use client";

import { useParams } from "next/navigation";
import { PartnerReceiptPage } from "@/components/domain/partner-receipt";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <PartnerReceiptPage id={params.id} />;
}
