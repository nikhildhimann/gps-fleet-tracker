"use client";

import { TileLayer } from "react-leaflet";

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

type Props = {
  satellite?: boolean;
};

export function MapTileLayer({ satellite = false }: Props) {
  const isSat = Boolean(satellite);

  // Prefer Google tiles when key is provided, otherwise fall back to existing providers.
  const url = GOOGLE_KEY
    ? isSat
      ? `https://mts1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&key=${GOOGLE_KEY}`
      : `https://mts1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key=${GOOGLE_KEY}`
    : isSat
    ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  const attribution = GOOGLE_KEY
    ? "Map data © Google"
    : isSat
    ? "&copy; Esri WorldImagery"
    : "&copy; OpenStreetMap";

  return <TileLayer attribution={attribution} url={url} />;
}

export default MapTileLayer;
