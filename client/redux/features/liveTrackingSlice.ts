import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface LiveTrackingState {
    liveVehicles: any[];
    selectedVehicleId: string | null;
    isConnected: boolean;
}

const initialState: LiveTrackingState = {
    liveVehicles: [],
    selectedVehicleId: null,
    isConnected: false,
};

const liveTrackingSlice = createSlice({
    name: "liveTracking",
    initialState,
    reducers: {
        setLiveVehicles: (state, action: PayloadAction<any[]>) => {
            state.liveVehicles = action.payload;
        },
        updateVehicleLocation: (state, action: PayloadAction<any>) => {
            const index = state.liveVehicles.findIndex(v => v.vehicleId === action.payload.vehicleId);
            if (index !== -1) {
                state.liveVehicles[index] = { ...state.liveVehicles[index], ...action.payload };
            } else {
                state.liveVehicles.push(action.payload);
            }
        },
        setSelectedTrackingVehicleId: (state, action: PayloadAction<string | null>) => {
            state.selectedVehicleId = action.payload;
        },
        setConnectionStatus: (state, action: PayloadAction<boolean>) => {
            state.isConnected = action.payload;
        },
    },
});

export const {
    setLiveVehicles,
    updateVehicleLocation,
    setSelectedTrackingVehicleId,
    setConnectionStatus
} = liveTrackingSlice.actions;

export default liveTrackingSlice.reducer;
