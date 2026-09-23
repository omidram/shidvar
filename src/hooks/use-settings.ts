"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { DEFAULT_NOTIFICATIONS, DEFAULT_PREFS, type PortalSettings, type TwoFactorChannel } from "@/lib/settings";
import { useI18n } from "@/i18n/provider";

export type SettingsDraft = {
  firstName: string;
  lastName: string;
  phone: string;
  tradeName: string;
  companyPhone: string;
  companyEmail: string;
  website: string;
  trackingAllowed: boolean;
  availableFrom: string;
  availableTo: string;
  twoFactorEnabled: boolean;
  twoFactorChannel: TwoFactorChannel;
  currentPassword: string;
  newPassword: string;
  notifications: PortalSettings["notifications"];
  prefs: PortalSettings["prefs"];
};

function toDraft(data: PortalSettings): SettingsDraft {
  return {
    firstName: data.user.firstName,
    lastName: data.user.lastName,
    phone: data.user.phone ?? "",
    tradeName: data.company?.tradeName ?? "",
    companyPhone: data.company?.phone ?? "",
    companyEmail: data.company?.email ?? "",
    website: data.company?.website ?? "",
    trackingAllowed: data.driver?.trackingAllowed ?? false,
    availableFrom: data.driver?.availableFrom || "08:00",
    availableTo: data.driver?.availableTo || "20:00",
    twoFactorEnabled: data.user.twoFactorEnabled,
    twoFactorChannel: data.user.twoFactorChannel ?? "EMAIL",
    currentPassword: "",
    newPassword: "",
    notifications: data.notifications ?? DEFAULT_NOTIFICATIONS,
    prefs: data.prefs ?? DEFAULT_PREFS,
  };
}

export function useSettingsForm() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["settings"], queryFn: () => api<PortalSettings>("/settings") });
  const [draft, setDraft] = useState<SettingsDraft | null>(null);

  useEffect(() => {
    if (query.data) setDraft(toDraft(query.data));
  }, [query.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!draft) return null;
      return api<PortalSettings>("/settings", {
        method: "PATCH",
        body: JSON.stringify({
          firstName: draft.firstName,
          lastName: draft.lastName,
          phone: draft.phone,
          tradeName: draft.tradeName || undefined,
          companyPhone: draft.companyPhone,
          companyEmail: draft.companyEmail,
          website: draft.website,
          trackingAllowed: draft.trackingAllowed,
          availableFrom: draft.availableFrom,
          availableTo: draft.availableTo,
          twoFactorEnabled: draft.twoFactorEnabled,
          twoFactorChannel: draft.twoFactorChannel,
          notifications: draft.notifications,
          prefs: draft.prefs,
          currentPassword: draft.currentPassword || undefined,
          newPassword: draft.newPassword || undefined,
        }),
      });
    },
    onSuccess: (data) => {
      if (data) {
        qc.setQueryData(["settings"], data);
        qc.invalidateQueries({ queryKey: ["me"] });
        setDraft({ ...toDraft(data), currentPassword: "", newPassword: "" });
      }
      toast.success(t.settings.saved);
    },
    onError: (error) => toast.error(formatApiError(error, t.common.error)),
  });

  return { query, draft, setDraft, save };
}
