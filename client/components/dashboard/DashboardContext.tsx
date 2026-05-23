"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import type { Vehicle } from "@/lib/vehicles"; // Assuming this is the correct path for the Vehicle type

// Define the context shape
interface DashboardContextProps {
    selectedVehicle: Vehicle | null;
    setSelectedVehicle: (vehicle: Vehicle | null) => void;
    focusKey: number;
    bumpFocusKey: () => void;
}

// Create the context
const DashboardContext = createContext<DashboardContextProps | undefined>(undefined);

// Create the provider component
export const DashboardProvider = ({ children }: { children: ReactNode }) => {
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    const [focusKey, setFocusKey] = useState(0);

    const bumpFocusKey = () => setFocusKey((k) => k + 1);

    return (
        <DashboardContext.Provider value={{ selectedVehicle, setSelectedVehicle, focusKey, bumpFocusKey }}>
            {children}
        </DashboardContext.Provider>
    );
};

// Create a custom hook to use the context
export const useDashboardContext = () => {
    const context = useContext(DashboardContext);
    if (context === undefined) {
        throw new Error("useDashboardContext must be used within a DashboardProvider");
    }
    return context;
};
