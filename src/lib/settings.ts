export const SETTINGS_VEHICLES = ["VAN", "LIGHT_TRUCK", "TRUCK", "HEAVY_TRUCK", "REFRIGERATED", "TANKER"] as const;

export type SettingsVehicle = (typeof SETTINGS_VEHICLES)[number];
export type TwoFactorChannel = "SMS" | "EMAIL";

export type SettingsNotifications = {
  jobSms: boolean;
  jobInApp: boolean;
  jobEmail: boolean;
  walletSms: boolean;
  walletInApp: boolean;
  docsInApp: boolean;
  docsEmail: boolean;
  marketingEmail: boolean;
};

export type SettingsPrefs = {
  acceptingLoads: boolean;
  nightShift: boolean;
  autoAcceptNearby: boolean;
  soundAlerts: boolean;
  hidePhoneUntilAccept: boolean;
  shareWeeklyReport: boolean;
  requireInsurance: boolean;
  requireWorkers: boolean;
  requireCover: boolean;
  autoPublish: boolean;
  weekendDelivery: boolean;
  defaultVehicle: SettingsVehicle;
};

export type PortalSettings = {
  user: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    locale: string;
    timezone: string;
    status: string;
    twoFactorEnabled: boolean;
    twoFactorChannel: TwoFactorChannel;
    emailVerified: boolean;
    phoneVerified: boolean;
    lastLoginAt: string | null;
  };
  company: {
    id: string;
    type: string;
    status: string;
    legalName: string;
    tradeName: string;
    taxId: string | null;
    registrationNumber: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    defaultCurrency: string;
    warehouseCount: number;
    storeCount: number;
    memberCount: number;
  } | null;
  driver: {
    id: string;
    status: string;
    licenseNumber: string | null;
    licenseType: string | null;
    trackingAllowed: boolean;
    availableFrom: string;
    availableTo: string;
    completedJobs: number;
    ratingAvg: number;
  } | null;
  notifications: SettingsNotifications;
  prefs: SettingsPrefs;
};

export const DEFAULT_NOTIFICATIONS: SettingsNotifications = {
  jobSms: true,
  jobInApp: true,
  jobEmail: true,
  walletSms: true,
  walletInApp: true,
  docsInApp: true,
  docsEmail: false,
  marketingEmail: false,
};

export const DEFAULT_PREFS: SettingsPrefs = {
  acceptingLoads: true,
  nightShift: false,
  autoAcceptNearby: false,
  soundAlerts: true,
  hidePhoneUntilAccept: true,
  shareWeeklyReport: true,
  requireInsurance: true,
  requireWorkers: false,
  requireCover: true,
  autoPublish: false,
  weekendDelivery: false,
  defaultVehicle: "TRUCK",
};
