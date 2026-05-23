import { baseApi } from "./baseApi";

type VehicleListParams = {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  organizationId?: string;
  [key: string]: string | number | boolean | null | undefined;
};

export const vehicleApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    getVehicles: builder.query({
      query: (params?: VehicleListParams) => {
        const hasParams =
          !!params &&
          Object.values(params).some(
            (value) => value !== undefined && value !== null && value !== "",
          );

        return {
          url: "/vehicle",
          params: hasParams ? params : undefined,
        };
      },
      providesTags: ["Vehicle"],
    }),
    getVehicle: builder.query({
      query: (id: string) => `/vehicle/${id}`,
      providesTags: ["Vehicle"],
    }),
    createVehicle: builder.mutation({
      query: (body) => ({
        url: "/vehicle",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Vehicle"],
    }),
    updateVehicle: builder.mutation({
      query: (payload: { id: string;[key: string]: unknown }) => {
        const { id, ...rest } = payload;
        return {
          url: `/vehicle/${id}`,
          method: "PUT",
          body: rest,
        };
      },
      invalidatesTags: ["Vehicle"],
    }),
    deleteVehicle: builder.mutation({
      query: (id: string) => ({
        url: `/vehicle/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Vehicle"],
    }),
    getGeofences: builder.query({
      query: () => "/geofence",
      providesTags: ["Geofence"],
    }),
  }),
});

export const {
  useGetVehiclesQuery,
  useGetVehicleQuery,
  useCreateVehicleMutation,
  useUpdateVehicleMutation,
  useDeleteVehicleMutation,
  useGetGeofencesQuery,
} = vehicleApi;
