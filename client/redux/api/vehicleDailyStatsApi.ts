import { baseApi } from "./baseApi";

export const vehicleDailyStatsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getVehicleDailyStats: builder.query({
      query: () => `/vehicleDailyStats`,
      providesTags: ["DailyStats"],
    }),
    getVehicleDailyStatsByVehicle: builder.query({
      query: (vehicleId: string) => `/vehicleDailyStats/vehicle/${vehicleId}`,
      providesTags: ["DailyStats"],
    }),
    getVehicleDailyStatsByDate: builder.query({
      query: ({ vehicleId, date }: { vehicleId: string; date: string }) =>
        `/vehicleDailyStats/vehicle/${vehicleId}/date/${date}`,
      providesTags: ["DailyStats"],
    }),
  }),
});

export const {
  useGetVehicleDailyStatsQuery,
  useGetVehicleDailyStatsByVehicleQuery,
  useGetVehicleDailyStatsByDateQuery,
} = vehicleDailyStatsApi;
