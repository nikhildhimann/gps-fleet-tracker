import { baseApi } from "./baseApi";

export const usersApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    getUsers: builder.query({
      query: (params) => ({
        url: "/users/by-organization",
        params,
      }),
      providesTags: ["User"],
    }),
    getMe: builder.query({
      query: () => "/users/me",
      providesTags: ["User"],
    }),
    getManagerByOrganization: builder.query({
      query: (params) => ({
        url: "/users/by-organization",
        params,
      }),
      providesTags: ["User"],
    }),
    createUser: builder.mutation({
      query: (body) => ({
        url: "/users",
        method: "POST",
        body,
      }),
      invalidatesTags: ["User"],
    }),
    updateUser: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/users/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["User"],
    }),
    deleteUser: builder.mutation({
      query: (id) => ({
        url: `/users/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["User"],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useGetMeQuery,
  useGetManagerByOrganizationQuery,
  //   useGetUsersByOrganizationQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
} = usersApi;
