import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface GpsDeviceState {
    selectedDeviceId: string | null;
    isModalOpen: boolean;
}

const initialState: GpsDeviceState = {
    selectedDeviceId: null,
    isModalOpen: false,
};

const gpsDeviceSlice = createSlice({
    name: "gpsDevice",
    initialState,
    reducers: {
        setSelectedDeviceId: (state, action: PayloadAction<string | null>) => {
            state.selectedDeviceId = action.payload;
        },
        toggleDeviceModal: (state, action: PayloadAction<boolean>) => {
            state.isModalOpen = action.payload;
        },
    },
});

export const { setSelectedDeviceId, toggleDeviceModal } = gpsDeviceSlice.actions;
export default gpsDeviceSlice.reducer;
