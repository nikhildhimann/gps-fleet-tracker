import { baseApi } from "./baseApi";

type HistoryQueryParams = {
    vehicleId: string
    from?: string
    to?: string
    page?: number
    limit?: number
    alertType?: string
    search?: string
}

const buildDateParams = ({ from, to }: { from?: string; to?: string }) => ({
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
})

export const gpsHistoryApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getVehicleHistory: builder.query({
            query: ({ vehicleId, from, to, page = 0, limit = 10000 }) => ({
                url: "/gpshistory",
                params: { vehicleId, from, to, page, limit },
            }),
            providesTags: ["History"],
        }),
        getStatistics: builder.query({
            query: ({ vehicleId, from, to }: HistoryQueryParams) => ({
                url: `/gps-history/statistics/${vehicleId}`,
                params: buildDateParams({ from, to }),
            }),
            providesTags: ["History"],
        }),
        getVehicleStatus: builder.query({
            query: ({ vehicleId, from, to }: HistoryQueryParams) => ({
                url: `/gps-history/vehicle-status/${vehicleId}`,
                params: buildDateParams({ from, to }),
            }),
            providesTags: ["History"],
        }),
        getGpsHistory: builder.query<{ data: { points: Array<{ latitude: number; longitude: number; speed: number; heading: number | null; gpsTimestamp: string; ignitionStatus: boolean; odometer: number; address?: string; poi?: string }> } }, { vehicleId: string; from: string; to: string }>({
            query: ({ vehicleId, from, to }) => ({
                url: `/gps-history/playback/${vehicleId}`,
                params: { from, to },
            }),
            providesTags: ["History"],
        }),
        getTravelSummary: builder.query({
            query: ({ vehicleId, from, to }: HistoryQueryParams) => ({
                url: `/gps-history/travel-summary/${vehicleId}`,
                params: buildDateParams({ from, to }),
            }),
            providesTags: ["History"],
        }),
        getTripSummary: builder.query({
            query: ({ vehicleId, from, to }: HistoryQueryParams) => ({
                url: `/gps-history/trip-summary/${vehicleId}`,
                params: buildDateParams({ from, to }),
            }),
            providesTags: ["History"],
        }),
        getDaywiseDistance: builder.query({
            query: ({ vehicleId, from, to }: HistoryQueryParams) => ({
                url: `/gps-history/daywise-distance/${vehicleId}`,
                params: buildDateParams({ from, to }),
            }),
            providesTags: ["History"],
        }),
        getAlertSummary: builder.query({
            query: ({ vehicleId, from, to, page, limit, alertType, search }: HistoryQueryParams) => ({
                url: `/gps-history/alert-summary/${vehicleId}`,
                params: {
                    ...buildDateParams({ from, to }),
                    ...(page !== undefined ? { page } : {}),
                    ...(limit !== undefined ? { limit } : {}),
                    ...(alertType ? { alertType } : {}),
                    ...(search ? { search } : {}),
                },
            }),
            providesTags: ["History"],
        }),
        getACSummary: builder.query({
            query: ({ vehicleId, from, to, page, limit }: HistoryQueryParams) => ({
                url: `/gps-history/ac-summary/${vehicleId}`,
                params: {
                    ...buildDateParams({ from, to }),
                    ...(page !== undefined ? { page } : {}),
                    ...(limit !== undefined ? { limit } : {}),
                },
            }),
            providesTags: ["History"],
        }),
    }),
});

export const {
    useGetVehicleHistoryQuery,
    useLazyGetVehicleHistoryQuery,
    useGetStatisticsQuery,
    useGetVehicleStatusQuery,
    useGetGpsHistoryQuery,
    useGetTravelSummaryQuery,
    useGetTripSummaryQuery,
    useGetDaywiseDistanceQuery,
    useGetAlertSummaryQuery,
    useGetACSummaryQuery,
} = gpsHistoryApi;
