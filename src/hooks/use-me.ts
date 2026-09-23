"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type Me = {
  userId: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  status: string;
  locale: string;
  isPlatformStaff: boolean;
  permissions: string[];
  memberships: Array<{ companyId: string; companyType: string; companyStatus: string; isOwner: boolean }>;
  driverProfile: { id: string; status: string; carrierCompanyId: string } | null;
  portal: string | null;
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api<Me>("/auth/me"),
    retry: false,
  });
}
