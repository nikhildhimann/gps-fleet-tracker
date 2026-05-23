import { baseApi } from "./baseApi";
import type {
  NotificationBulkMutationResponse,
  NotificationCountsResponse,
  NotificationListResponse,
  NotificationMutationResponse,
  NotificationQueryParams,
} from "@/lib/adminNotifications";

const LIST_TAG = { type: "Notification" as const, id: "ADMIN_LIST" };
const COUNTS_TAG = { type: "Notification" as const, id: "ADMIN_COUNTS" };

const buildTags = (result?: NotificationListResponse) => {
  if (!result?.data?.length) {
    return [LIST_TAG, COUNTS_TAG];
  }

  return [
    ...result.data.map((notification) => ({
      type: "Notification" as const,
      id: notification._id,
    })),
    LIST_TAG,
    COUNTS_TAG,
  ];
};

export const adminNotificationsApi = baseApi.injectEndpoints({
  overrideExisting: false,
  endpoints: (builder) => ({
    getAdminNotifications: builder.query<NotificationListResponse, NotificationQueryParams | void>({
      query: (params) => ({
        url: "/notifications",
        params,
      }),
      providesTags: (result) => buildTags(result),
    }),

    getAdminNotificationCounts: builder.query<
      NotificationCountsResponse,
      Omit<NotificationQueryParams, "page" | "limit" | "search"> | void
    >({
      query: (params) => ({
        url: "/notifications/counts",
        params,
      }),
      providesTags: [COUNTS_TAG],
    }),

    markAdminNotificationAsRead: builder.mutation<NotificationMutationResponse, string>({
      query: (id) => ({
        url: `/notifications/${id}/read`,
        method: "PATCH",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Notification", id },
        LIST_TAG,
        COUNTS_TAG,
      ],
    }),

    markAdminNotificationAsAcknowledged: builder.mutation<NotificationMutationResponse, string>({
      query: (id) => ({
        url: `/notifications/${id}/acknowledge`,
        method: "PATCH",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Notification", id },
        LIST_TAG,
        COUNTS_TAG,
      ],
    }),

    markAdminNotificationAsResolved: builder.mutation<NotificationMutationResponse, string>({
      query: (id) => ({
        url: `/notifications/${id}/resolve`,
        method: "PATCH",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Notification", id },
        LIST_TAG,
        COUNTS_TAG,
      ],
    }),

    bulkMarkAdminNotificationsAsRead: builder.mutation<
      NotificationBulkMutationResponse,
      NotificationQueryParams | void
    >({
      query: (body) => ({
        url: "/notifications/bulk/read",
        method: "PATCH",
        body,
      }),
      invalidatesTags: [LIST_TAG, COUNTS_TAG],
    }),

    bulkMarkAdminNotificationsAsAcknowledged: builder.mutation<
      NotificationBulkMutationResponse,
      NotificationQueryParams | void
    >({
      query: (body) => ({
        url: "/notifications/bulk/acknowledge",
        method: "PATCH",
        body,
      }),
      invalidatesTags: [LIST_TAG, COUNTS_TAG],
    }),

    deleteAdminNotification: builder.mutation<{ status: boolean; message: string }, string>({
      query: (id) => ({
        url: `/notifications/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Notification", id },
        LIST_TAG,
        COUNTS_TAG,
      ],
    }),
  }),
});

export const {
  useGetAdminNotificationsQuery,
  useGetAdminNotificationCountsQuery,
  useMarkAdminNotificationAsReadMutation,
  useMarkAdminNotificationAsAcknowledgedMutation,
  useMarkAdminNotificationAsResolvedMutation,
  useBulkMarkAdminNotificationsAsReadMutation,
  useBulkMarkAdminNotificationsAsAcknowledgedMutation,
  useDeleteAdminNotificationMutation,
} = adminNotificationsApi;
