// Shared dummy data store for admin panel
// All data is stored in memory and persists during session

export type Organization = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  status: "active" | "inactive";
  logo?: string;
  parentId?: string | null;
  createdAt?: string;
};

export type Vehicle = {
  _id: string;
  organizationId: string;
  vehicleType: string;
  vehicleNumber: string;
  model?: string;
  driverName?: string;
  status?: "active" | "inactive" | "online" | "offline";
  assignedDeviceId?: string | null;
  year?: string;
  color?: string;
  registrationDate?: string;
};

export type GPSDevice = {
  _id: string;
  imei: string;
  simNumber?: string;
  model?: string;
  status: "active" | "inactive";
  assignedVehicleId?: string | null;
  firmwareVersion?: string;
  lastSeen?: string;
};

export type User = {
  _id: string;
  name: string;
  email: string;
  password?: string;
  role: "admin" | "manager" | "driver" | "superadmin";
  organizationId?: string | null;
  status?: "active" | "inactive";
};

export type DeviceMapping = {
  _id: string;
  vehicleId: string;
  deviceId: string;
  createdAt: string;
};

export type Notification = {
  _id: string;
  type: "vehicle_online" | "vehicle_offline" | "device_added" | "device_removed" | "alert";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
};

// Initial dummy data
let organizations: Organization[] = [
  { _id: "org_ajiva", name: "Ajiva Tracker", email: "admin@ajiva.com", phone: "+91 98765 43210", address: "Delhi HQ", status: "active", parentId: null },
  { _id: "org_north", name: "North Branch", email: "north@ajiva.com", phone: "+91 98765 43211", address: "Chandigarh", status: "active", parentId: "org_ajiva" },
  { _id: "org_west", name: "West Branch", email: "west@ajiva.com", phone: "+91 98765 43212", address: "Jaipur", status: "inactive", parentId: "org_ajiva" },
  { _id: "org_south", name: "South Branch", email: "south@ajiva.com", phone: "+91 98765 43213", address: "Bangalore", status: "active", parentId: "org_ajiva" },
];

let vehicles: Vehicle[] = [
  { _id: "veh_1", organizationId: "org_ajiva", vehicleType: "car", vehicleNumber: "DL 10CK1840", model: "Camry", driverName: "Dave Mathew", status: "online", assignedDeviceId: "gps_1" },
  { _id: "veh_2", organizationId: "org_north", vehicleType: "truck", vehicleNumber: "PB 10AX2234", model: "Tata 407", driverName: "Mitchell", status: "online", assignedDeviceId: "gps_2" },
  { _id: "veh_3", organizationId: "org_west", vehicleType: "bus", vehicleNumber: "RJ 14AB5678", model: "Volvo", driverName: "Olivia", status: "offline", assignedDeviceId: null },
  { _id: "veh_4", organizationId: "org_south", vehicleType: "car", vehicleNumber: "KA 01MN1234", model: "Honda City", driverName: "Ravi", status: "offline", assignedDeviceId: null },
];

let devices: GPSDevice[] = [
  { _id: "gps_1", imei: "86543210001", simNumber: "+919876543210", model: "GT-900", status: "active", assignedVehicleId: "veh_1", firmwareVersion: "v2.1.0", lastSeen: new Date().toISOString() },
  { _id: "gps_2", imei: "86543210002", simNumber: "+919876543211", model: "GT-1000", status: "active", assignedVehicleId: "veh_2", firmwareVersion: "v2.2.0", lastSeen: new Date().toISOString() },
  { _id: "gps_3", imei: "86543210003", simNumber: "+919876543212", model: "GT-900", status: "inactive", assignedVehicleId: null, firmwareVersion: "v2.0.0", lastSeen: new Date(Date.now() - 86400000).toISOString() },
];

let users: User[] = [
  { _id: "user_1", name: "Admin User", email: "admin@ajiva.com", role: "admin", organizationId: "org_ajiva", status: "active" },
  { _id: "user_2", name: "Manager John", email: "manager@ajiva.com", role: "manager", organizationId: "org_ajiva", status: "active" },
  { _id: "user_3", name: "Driver Mike", email: "driver@ajiva.com", role: "driver", organizationId: "org_ajiva", status: "active" },
];

let mappings: DeviceMapping[] = [
  { _id: "map_1", vehicleId: "veh_1", deviceId: "gps_1", createdAt: new Date().toISOString() },
  { _id: "map_2", vehicleId: "veh_2", deviceId: "gps_2", createdAt: new Date().toISOString() },
];

let notifications: Notification[] = [
  { _id: "notif_1", type: "vehicle_online", title: "Vehicle Online", message: "Vehicle DL 10CK1840 is now online", timestamp: new Date(Date.now() - 3600000).toISOString(), read: false },
  { _id: "notif_2", type: "device_added", title: "New Device Added", message: "GPS device 86543210003 has been added", timestamp: new Date(Date.now() - 7200000).toISOString(), read: false },
  { _id: "notif_3", type: "vehicle_offline", title: "Vehicle Offline", message: "Vehicle RJ 14AB5678 went offline", timestamp: new Date(Date.now() - 10800000).toISOString(), read: true },
  { _id: "notif_4", type: "alert", title: "Speed Alert", message: "Vehicle PB 10AX2234 exceeded speed limit", timestamp: new Date(Date.now() - 14400000).toISOString(), read: false },
];

// Admin user data
let adminUser = {
  name: "Admin User",
  email: "admin@ajiva.com",
  organizationId: "org_ajiva",
  avatar: "AD",
  organizationLogo: null as string | null,
};

// Getters
export const getOrganizations = () => [...organizations];
export const getVehicles = () => [...vehicles];
export const getDevices = () => [...devices];
export const getUsers = () => [...users];
export const getMappings = () => [...mappings];
export const getNotifications = () => [...notifications];
export const getAdminUser = () => ({ ...adminUser });
export const getRootOrganization = () => organizations.find(org => !org.parentId) || organizations[0];

// Setters
export const setOrganizations = (newOrgs: Organization[]) => { organizations = newOrgs; };
export const setVehicles = (newVehicles: Vehicle[]) => { vehicles = newVehicles; };
export const setDevices = (newDevices: GPSDevice[]) => { devices = newDevices; };
export const setUsers = (newUsers: User[]) => { users = newUsers; };
export const setMappings = (newMappings: DeviceMapping[]) => { mappings = newMappings; };
export const setNotifications = (newNotifications: Notification[]) => { notifications = newNotifications; };
export const setAdminUser = (newAdmin: typeof adminUser) => { adminUser = newAdmin; };
export const setRootOrganization = (updates: Partial<Organization>) => {
  const rootOrgIndex = organizations.findIndex(org => !org.parentId);
  if (rootOrgIndex !== -1) {
    organizations[rootOrgIndex] = { ...organizations[rootOrgIndex], ...updates };
  }
};

// Search function
export const searchAll = (query: string) => {
  const lowerQuery = query.toLowerCase();
  const results: Array<{ type: string; id: string; name: string; details: string }> = [];

  organizations.forEach(org => {
    if (org.name.toLowerCase().includes(lowerQuery) ||
      org._id.toLowerCase().includes(lowerQuery) ||
      org.email.toLowerCase().includes(lowerQuery)) {
      results.push({ type: "Organization", id: org._id, name: org.name, details: org.email });
    }
  });

  vehicles.forEach(veh => {
    if (veh.vehicleNumber.toLowerCase().includes(lowerQuery) ||
      veh._id.toLowerCase().includes(lowerQuery) ||
      veh.model?.toLowerCase().includes(lowerQuery)) {
      results.push({ type: "Vehicle", id: veh._id, name: veh.vehicleNumber, details: veh.model || "" });
    }
  });

  devices.forEach(dev => {
    if (dev.imei.includes(lowerQuery) ||
      dev._id.toLowerCase().includes(lowerQuery) ||
      dev.simNumber?.includes(lowerQuery)) {
      results.push({ type: "GPS Device", id: dev._id, name: dev.imei, details: dev.model || "" });
    }
  });

  users.forEach(user => {
    if (user.name.toLowerCase().includes(lowerQuery) ||
      user.email.toLowerCase().includes(lowerQuery) ||
      user._id.toLowerCase().includes(lowerQuery)) {
      results.push({ type: "User", id: user._id, name: user.name, details: user.email });
    }
  });

  return results;
};
