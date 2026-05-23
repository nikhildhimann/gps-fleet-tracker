import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface VehicleState {
    selectedVehicleId: string | null;
    activeTab: string;
    isModalOpen: boolean;
}

const initialState: VehicleState = {
    selectedVehicleId: null,
    activeTab: "Tracking",
    isModalOpen: false,
};

const vehicleSlice = createSlice({
    name: "vehicle",
    initialState,
    reducers: {
        setSelectedVehicle: (state, action: PayloadAction<string | null>) => {
            state.selectedVehicleId = action.payload;
        },
        setActiveTab: (state, action: PayloadAction<string>) => {
            state.activeTab = action.payload;
        },
        toggleVehicleModal: (state, action: PayloadAction<boolean>) => {
            state.isModalOpen = action.payload;
        },
    },
});

export const { setSelectedVehicle, setActiveTab, toggleVehicleModal } = vehicleSlice.actions;
export default vehicleSlice.reducer;
