export interface Organization {
    _id: string;
    name: string;
    email: string;
    phone: string;
    address: string | {
        addressLine?: string;
        city?: string;
        state?: string;
        country?: string;
        pincode?: string;
    };
    logo?: string;
    contactPerson?: string;
    status: string;
}

export interface Vehicle {
    _id: string;
    vehicleNumber: string;
    vehicleType: string;
    model: string;
    status: string;
    organizationId: string | Organization;
    registrationNumber?: string;
    driverName?: string;
    driverPhone?: string;
    vehicleImage?: string;
}

export interface LiveVehicle {
    vehicleId: string | Vehicle;
    status: "running" | "online" | "idle" | "stopped" | "offline";
    location?: {
        type: string;
        coordinates: [number, number];
        speed: number;
        ignition: boolean;
    };
    updatedAt: string;
}

export interface IGpsDevice {
    _id: string;
    imei: string;
    model: string;
    status: string;
}

export interface IDeviceMapping {
    _id: string;
    vehicleId: Vehicle;
    gpsDeviceId: IGpsDevice;
    createdAt: string;
}

export interface IApiError {
    data?: {
        message?: string;
    };
    message?: string;
}

export interface PaginatedResponse<T> {
    status: boolean;
    message: string;
    data: T;
    pagination?: {
        totalrecords: number;
        currentPage: number;
        totalPages: number;
        limit: number;
    };
}

export interface DashboardStats {
    running: number;
    idle: number;
    stopped: number;
    inactive: number;
    noData: number;
    total: number;
}
