"use client";

import LeafletLiveMap from "./LeafletLiveMap";

type LiveVehicle = {
  id: string;
  vehicleNumber: string;
  lat: number;
  lng: number;
  speed: number;
  heading?: number;
  lastUpdated: string;
  status?: string;
};

const demoVehicles: LiveVehicle[] = [
  {
    id: "veh_1",
    vehicleNumber: "DL 10CK1840",
    lat: 28.6139,
    lng: 77.209,
    speed: 42,
    lastUpdated: new Date().toISOString(),
  },
  {
    id: "veh_2",
    vehicleNumber: "PB 10AX2234",
    lat: 28.7041,
    lng: 77.1025,
    speed: 0,
    lastUpdated: new Date().toISOString(),
  },
];

export default function LiveMap({ vehicles = demoVehicles }: { vehicles?: LiveVehicle[] }) {
  return <LeafletLiveMap vehicles={vehicles} />;
}
