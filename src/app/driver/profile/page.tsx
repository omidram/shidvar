"use client";

import { DriverProfileView } from "@/components/domain/driver-profile-view";
import { ErrorState } from "@/components/domain/chrome";
import { useMe } from "@/hooks/use-me";
import { useI18n } from "@/i18n/provider";

export default function DriverProfilePage() {
  const { t } = useI18n();
  const me = useMe();
  if (me.isLoading) return <p>{t.common.loading}</p>;
  if (!me.data?.driverProfile?.id) return <ErrorState message={t.common.error} />;
  return <DriverProfileView id={me.data.driverProfile.id} />;
}
