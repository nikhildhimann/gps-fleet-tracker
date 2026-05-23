import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQuery } from "./commonApi";

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: ["Organization", "Vehicle", "GPSDevice", "DeviceMapping", "Tracking", "History", "User", "Permission", "Notification", "Driver", "Geofence", "DailyStats"],
  endpoints: () => ({}),
});
