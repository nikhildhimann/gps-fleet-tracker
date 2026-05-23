import { baseApi } from "./baseApi";

export const notificationsApi = baseApi.injectEndpoints({
    overrideExisting: true,
    endpoints: (builder) => ({
        getNotifications: builder.query({
            query: () => "/alerts", // Backend uses /alerts
            providesTags: ["Notification"],
        }),
        getNotificationCounts: builder.query({
            query: () => "/alerts/counts", // Assuming backend has this endpoint
            providesTags: ["Notification"],
        }),
        markAsRead: builder.mutation({
            query: (id) => ({
                url: `/alerts/${id}/ack`, // Backend uses /alerts/:id/ack
                method: "POST",
            }),
            invalidatesTags: ["Notification"],
        }),
        markAllAsRead: builder.mutation({
            query: () => ({
                url: `/alerts/ack-all`, // Placeholder, verify if backend adds this later or handle gracefully
                method: "POST",
            }),
            invalidatesTags: ["Notification"],
        }),
        deleteNotification: builder.mutation({
            query: (id) => ({
                url: `/alerts/${id}`, // Backend uses /alerts/:id for delete
                method: "DELETE",
            }),
            invalidatesTags: ["Notification"],
        }),
        clearAllNotifications: builder.mutation({
            query: () => ({
                url: `/alerts`,
                method: "DELETE",
            }),
            invalidatesTags: ["Notification"],
        }),
    }),
});

export const {
    useGetNotificationsQuery,
    useGetNotificationCountsQuery,
    useMarkAsReadMutation,
    useMarkAllAsReadMutation,
    useDeleteNotificationMutation,
    useClearAllNotificationsMutation
} = notificationsApi;
