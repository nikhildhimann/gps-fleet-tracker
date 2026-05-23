import { baseApi } from "./baseApi";

export const deviceMappingApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getDeviceMappings: builder.query({
            query: (params) => ({
                url: "/devicemapping",
                params,
            }),
            providesTags: ["DeviceMapping"],
        }),
        assignDevice: builder.mutation({
            query: (body) => ({
                url: "/devicemapping",
                method: "POST",
                body,
            }),
            invalidatesTags: ["DeviceMapping", "Vehicle", "GPSDevice"],
        }),
        unassignDevice: builder.mutation({
            query: (id) => ({
                url: `/devicemapping/${id}/unassign`,
                method: "PATCH",
            }),
            invalidatesTags: ["DeviceMapping", "Vehicle", "GPSDevice"],
        }),
        unassignDeviceByDetails: builder.mutation({
            query: (body) => ({
                url: "/devicemapping/unassign",
                method: "PATCH",
                body,
            }),
            invalidatesTags: ["DeviceMapping", "Vehicle", "GPSDevice"],
        }),
        deleteMapping: builder.mutation({
            query: (id) => ({
                url: `/devicemapping/${id}`,
                method: "DELETE"
            }),
            invalidatesTags: ["DeviceMapping"]
        })
    }),
});

export const {
    useGetDeviceMappingsQuery,
    useAssignDeviceMutation,
    useUnassignDeviceMutation,
    useUnassignDeviceByDetailsMutation,
    useDeleteMappingMutation,
} = deviceMappingApi;
