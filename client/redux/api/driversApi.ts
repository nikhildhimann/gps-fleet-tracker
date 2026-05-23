import { baseApi } from "./baseApi";

export const driversApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDrivers: builder.query({
      query: (params) => ({
        url: "/drivers",
        params
      }),
      providesTags: ["Driver"],
    }),
    getDriver: builder.query({
      query: (id) => `/drivers/${id}`,
      providesTags: ["Driver"],
    }),
    createDriverWithUser: builder.mutation({
      query: (body) => ({
        url: "/drivers/create-with-user",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Driver", "User"],
    }),
    updateDriver: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/drivers/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Driver"],
    }),
    deleteDriver: builder.mutation({
      query: (id) => ({
        url: `/drivers/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Driver"],
    }),
  }),
});

export const {
  useGetDriversQuery,
  useGetDriverQuery,
  useCreateDriverWithUserMutation,
  useUpdateDriverMutation,
  useDeleteDriverMutation,
} = driversApi;
