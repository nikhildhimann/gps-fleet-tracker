export const MAX_IMPORT_FILE_SIZE_BYTES = 25 * 1024 * 1024;
export const MAX_IMPORT_FILE_SIZE_LABEL = "25MB";
export const IMPORT_ACCEPT_ATTRIBUTE = ".csv,.xlsx,.xls";

export type ImportModuleGuide = {
  required: string[];
  optional: string[];
  mappingFields?: string[];
  dataColumns: string[];
  exampleRow: Record<string, string>;
  enumFields?: Record<string, string[]>;
  notes?: string[];
};

export const DEVICE_IMPORT_FIELDS = [
  "organizationName",
  "imei",
  "softwareVersion",
  "vendorId",
  "deviceModel",
  "manufacturer",
  "simNumber",
  "serialNumber",
  "firmwareVersion",
  "hardwareVersion",
  "warrantyExpiry",
  "status",
  "vehicleRegistrationNumber",
] as const;

export const IMPORT_MODULE_GUIDES: Record<string, ImportModuleGuide> = {
  organizations: {
    required: ["name", "organizationType", "email", "phone"],
    optional: ["addressLine", "city", "state", "country", "pincode", "status"],
    mappingFields: [],
    dataColumns: ["name", "organizationType", "email", "phone", "addressLine", "city", "state", "country", "pincode", "status"],
    exampleRow: {
      name: "North Fleet Logistics",
      organizationType: "logistics",
      email: "northfleet@example.com",
      phone: "+919876543210",
      addressLine: "101 Industrial Park",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      pincode: "400001",
      status: "active",
    },
    enumFields: {
      organizationType: ["logistics", "transport", "school", "taxi", "fleet"],
      status: ["active", "inactive"],
    },
    notes: [
      "Do not include parent organization columns.",
      "Organization is created under the selected or current organization context where applicable.",
      "Phone must be a valid international number with country code.",
    ],
  },
  users: {
    required: ["firstName", "email", "mobile", "role", "password"],
    optional: ["lastName", "status"],
    mappingFields: [],
    dataColumns: ["firstName", "lastName", "email", "mobile", "role", "status", "password"],
    exampleRow: {
      firstName: "Amit",
      lastName: "Sharma",
      email: "amit.sharma@example.com",
      mobile: "+919876543211",
      role: "admin",
      status: "active",
      password: "Secret123",
    },
    enumFields: {
      role: ["admin", "driver"],
      status: ["active", "inactive"],
    },
    notes: [
      "Do not include organization scope columns.",
      "Password must be at least 6 characters.",
    ],
  },
  vehicles: {
    required: ["vehicleType", "vehicleNumber"],
    optional: [
      "ais140Compliant",
      "ais140CertificateNumber",
      "make",
      "model",
      "year",
      "color",
      "status",
      "runningStatus",
      "lastUpdated",
      "deviceImei",
    ],
    mappingFields: ["deviceImei"],
    dataColumns: [
      "vehicleType",
      "vehicleNumber",
      "ais140Compliant",
      "ais140CertificateNumber",
      "make",
      "model",
      "year",
      "color",
      "status",
      "runningStatus",
      "lastUpdated",
      "deviceImei",
    ],
    exampleRow: {
      vehicleType: "truck",
      vehicleNumber: "MH12AB1234",
      ais140Compliant: "true",
      ais140CertificateNumber: "CERT000001",
      make: "Tata",
      model: "Ace Gold",
      year: "2024",
      color: "White",
      status: "active",
      runningStatus: "inactive",
      lastUpdated: "2026-03-13T09:30:00.000Z",
      deviceImei: "123456789012345",
    },
    enumFields: {
      vehicleType: ["car", "bus", "truck", "bike", "other"],
      status: ["active", "inactive", "maintenance", "decommissioned"],
      runningStatus: ["running", "idle", "stopped", "inactive"],
      ais140Compliant: ["true", "false"],
    },
    notes: [
      "deviceImei is optional and is used only when you want to link an existing device during import.",
      "Do not include organization scope columns.",
    ],
  },
  devices: {
    required: ["imei", "softwareVersion"],
    optional: [
      "vendorId",
      "deviceModel",
      "manufacturer",
      "simNumber",
      "serialNumber",
      "firmwareVersion",
      "hardwareVersion",
      "warrantyExpiry",
      "status",
      "vehicleRegistrationNumber",
    ],
    mappingFields: ["vehicleRegistrationNumber"],
    dataColumns: [
      "imei",
      "softwareVersion",
      "vendorId",
      "deviceModel",
      "manufacturer",
      "simNumber",
      "serialNumber",
      "firmwareVersion",
      "hardwareVersion",
      "warrantyExpiry",
      "status",
      "vehicleRegistrationNumber",
    ],
    exampleRow: {
      imei: "123456789012345",
      softwareVersion: "1.0.4",
      vendorId: "ROADRPA",
      deviceModel: "RX-100",
      manufacturer: "Ajiva Devices",
      simNumber: "+919876543212",
      serialNumber: "SN-0001",
      firmwareVersion: "1.0.4",
      hardwareVersion: "HW-2",
      warrantyExpiry: "2027-03-13",
      status: "active",
      vehicleRegistrationNumber: "MH12AB1234",
    },
    enumFields: {
      status: ["active", "inactive", "suspended"],
    },
    notes: [
      "IMEI must be exactly 15 digits.",
      "vehicleRegistrationNumber is for mapping or linking only.",
      "Do not include organization scope columns or runtime telemetry fields.",
    ],
  },
  drivers: {
    required: ["firstName", "lastName", "email", "phone", "licenseNumber", "password"],
    optional: ["licenseExpiry", "status"],
    mappingFields: [],
    dataColumns: ["firstName", "lastName", "email", "phone", "licenseNumber", "licenseExpiry", "status", "password"],
    exampleRow: {
      firstName: "Rohit",
      lastName: "Kumar",
      email: "rohit.kumar@example.com",
      phone: "+919876543213",
      licenseNumber: "DL01AB1234",
      licenseExpiry: "2027-06-01",
      status: "active",
      password: "Secret123",
    },
    enumFields: {
      status: ["active", "inactive", "blocked"],
    },
    notes: [
      "Do not include organization scope columns.",
      "licenseExpiry format should be YYYY-MM-DD.",
      "Password must be at least 6 characters.",
    ],
  },
  deviceMapping: {
    required: ["vehicleNumber", "imei"],
    optional: [],
    mappingFields: ["vehicleNumber", "imei"],
    dataColumns: ["vehicleNumber", "imei"],
    exampleRow: {
      vehicleNumber: "DL01AB1234",
      imei: "865342056789012",
    },
    notes: [
      "Vehicle must already exist.",
      "Device must already exist.",
      "Device must be valid for mapping in the current organization scope.",
    ],
  },
  driverMapping: {
    required: ["vehicleNumber", "driverEmail"],
    optional: [],
    mappingFields: ["vehicleNumber", "driverEmail"],
    dataColumns: ["vehicleNumber", "driverEmail"],
    exampleRow: {
      vehicleNumber: "DL01AB1234",
      driverEmail: "driver1@test.com",
    },
    notes: [
      "Vehicle must already exist.",
      "Driver must already exist.",
      "Driver must be active.",
      "Mapping must stay inside the allowed organization scope.",
    ],
  },
};
