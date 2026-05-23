import { baseApi } from "./baseApi";
import type { InventoryFilters, InventoryUpdatePayload } from "@/components/gps-devices/inventoryTypes";

export const gpsDeviceApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getGpsDevices: builder.query({
            query: (params) => ({
                url: "/gpsdevice",
                params,
            }),
            providesTags: ["GPSDevice"],
        }),
        getGpsDevice: builder.query({
            query: (id) => `/gpsdevice/${id}`,
            providesTags: ["GPSDevice"],
        }),
        createGpsDevice: builder.mutation({
            query: (body) => ({
                url: "/gpsdevice",
                method: "POST",
                body,
            }),
            invalidatesTags: ["GPSDevice"],
        }),
        updateGpsDevice: builder.mutation({
            query: ({ id, ...body }) => ({
                url: `/gpsdevice/${id}`,
                method: "PUT",
                body,
            }),
            invalidatesTags: ["GPSDevice"],
        }),
        deleteGpsDevice: builder.mutation({
            query: (id) => ({
                url: `/gpsdevice/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["GPSDevice"],
        }),
        getGpsDeviceInventory: builder.query({
            query: (params?: Partial<InventoryFilters> & { page?: number; limit?: number; search?: string }) => {
                const queryParams: Record<string, string | number> = {};

                if (params?.page !== undefined) queryParams.page = params.page;
                if (params?.limit !== undefined) queryParams.limit = params.limit;
                if (params?.search) queryParams.search = params.search;
                if (params?.inventoryStatus) queryParams["inventory.status"] = params.inventoryStatus;
                if (params?.manufacturer) queryParams.manufacturer = params.manufacturer;
                if (params?.supplierName) queryParams.supplierName = params.supplierName;
                if (params?.warrantyExpiry) queryParams.warrantyExpiry = params.warrantyExpiry;

                return {
                    url: "/gps-device/inventory",
                    params: queryParams,
                };
            },
            providesTags: ["GPSDevice"],
        }),
        getGpsDeviceInventoryById: builder.query({
            query: (id) => `/gps-device/inventory/${id}`,
            providesTags: ["GPSDevice"],
        }),
        updateGpsDeviceInventory: builder.mutation({
            query: ({ id, inventory }: { id: string; inventory: InventoryUpdatePayload }) => ({
                url: `/gps-device/inventory/${id}`,
                method: "PATCH",
                body: { inventory },
            }),
            invalidatesTags: ["GPSDevice"],
        }),
    }),
});

export const {
    useGetGpsDevicesQuery,
    useGetGpsDeviceQuery,
    useCreateGpsDeviceMutation,
    useUpdateGpsDeviceMutation,
    useDeleteGpsDeviceMutation,
    useGetGpsDeviceInventoryQuery,
    useGetGpsDeviceInventoryByIdQuery,
    useUpdateGpsDeviceInventoryMutation,
} = gpsDeviceApi;
