import { baseApi } from "./baseApi";

export const vehicleDriverMappingApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getVehicleDriverMappings: builder.query({
            query: () => "/vehicledrivermapping",
            providesTags: ["Vehicle", "Driver"],
        }),
        assignDriver: builder.mutation({
            query: (body) => ({
                url: "/vehicledrivermapping/assign",
                method: "POST",
                body,
            }),
            invalidatesTags: ["Vehicle", "Driver"],
        }),
        unassignDriver: builder.mutation({
            query: (body) => ({
                url: "/vehicledrivermapping/unassign",
                method: "POST",
                body,
            }),
            invalidatesTags: ["Vehicle", "Driver"],
        }),
    }),
});

export const {
    useGetVehicleDriverMappingsQuery,
    useAssignDriverMutation,
    useUnassignDriverMutation,
} = vehicleDriverMappingApi;
