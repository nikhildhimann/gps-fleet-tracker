export const API_ROUTES = {
  // ================= AUTH =================
  LOGIN: "/users/login",
  LOGOUT: "/logout",

  // ================= ORGANIZATIONS =================
  ORGANIZATIONS: "/organizations",
  ORGANIZATION_BY_ID: (id: string) => `/organizations/${id}`,

  // ================= USERS =================
  USERS: "/users",
  USER_BY_ID: (id: string) => `/users/${id}`,

  // ================= VEHICLES =================
  VEHICLES: "/vehicles",
  VEHICLE_BY_ID: (id: string) => `/vehicles/${id}`,

  // ================= GPS DEVICES =================
  GPS_DEVICES: "/gps-devices",
  GPS_DEVICE_BY_ID: (id: string) => `/gps-devices/${id}`,

  // ================= DEVICE MAPPING =================
  DEVICE_MAPPING: "/device-mapping",

  // ================= LIVE TRACKING =================
  LIVE_TRACKING: "/live-tracking",

  // ================= HISTORY =================
  GPS_HISTORY: (vehicleId: string) => `/gps-history/${vehicleId}`,
} as const;
