import { baseApi } from "./baseApi";

export const permissionsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getPermissions: builder.query({
            query: () => "/permissions",
            providesTags: ["Permission"],
        }),
        getPermission: builder.query({
            query: (id) => `/permissions/${id}`,
            providesTags: ["Permission"],
        }),
        createPermission: builder.mutation({
            query: (body) => ({
                url: "/permissions",
                method: "POST",
                body,
            }),
            invalidatesTags: ["Permission"],
        }),
        updatePermission: builder.mutation({
            query: ({ id, ...body }) => ({
                url: `/permissions/${id}`,
                method: "PUT",
                body,
            }),
            invalidatesTags: ["Permission"],
        }),
        deletePermission: builder.mutation({
            query: (id) => ({
                url: `/permissions/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["Permission"],
        }),
    }),
});

export const {
    useGetPermissionsQuery,
    useGetPermissionQuery,
    useCreatePermissionMutation,
    useUpdatePermissionMutation,
    useDeletePermissionMutation,
} = permissionsApi;
