import { baseApi } from "./baseApi";

export const organizationApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    /* =========================
       READ
    ========================= */

    // 1️⃣ Get organizations (scoped)
    getOrganizations: builder.query({
      query: (params) => ({
        url: "/organizations",
        params,
      }),
      providesTags: ["Organization"],
    }),

    // 2️⃣ Get sub-organizations
    getSubOrganizations: builder.query({
      query: (params) => ({
        url: "/organizations/sub",
        params,
      }),
      providesTags: ["Organization"],
    }),

    // 3️⃣ Get organization by id
    getOrganization: builder.query({
      query: (id) => `/organizations/${id}`,
      providesTags: ["Organization"],
    }),

    /* =========================
       CREATE
    ========================= */

    // 4️⃣ Create root organization + admin (superadmin only)
    createOrganization: builder.mutation({
      query: (body) => ({
        url: "/organizations",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Organization"],
    }),

    // 5️⃣ Create sub-organization + admin
    createSubOrganizationWithManager: builder.mutation({
      query: (body) => ({
        url: "/organizations/sub", // ✅ MATCHES BACKEND
        method: "POST",
        body,
      }),
      invalidatesTags: ["Organization", "User"],
    }),

    /* =========================
       UPDATE
    ========================= */

    // 6️⃣ Update organization
    updateOrganization: builder.mutation({
      query: ({ id, body }) => ({
        url: `/organizations/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Organization", "User"],
    }),

    /* =========================
       DELETE
    ========================= */

    // 7️⃣ Delete organization
    deleteOrganization: builder.mutation({
      query: (id) => ({
        url: `/organizations/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Organization"],
    }),
  }),
});

export const {
  useGetOrganizationsQuery,
  useGetSubOrganizationsQuery,
  useGetOrganizationQuery,
  useCreateOrganizationMutation,
  useCreateSubOrganizationWithManagerMutation,
  useUpdateOrganizationMutation,
  useDeleteOrganizationMutation,
} = organizationApi;
