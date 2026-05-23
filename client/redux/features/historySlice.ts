import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface HistoryState {
    selectedVehicleId: string | null;
    dateRange: { from: string; to: string } | null;
    historyData: any[];
    isPlaying: boolean;
}

const initialState: HistoryState = {
    selectedVehicleId: null,
    dateRange: null,
    historyData: [],
    isPlaying: false,
};

const historySlice = createSlice({
    name: "history",
    initialState,
    reducers: {
        setSelectedHistoryVehicleId: (state, action: PayloadAction<string | null>) => {
            state.selectedVehicleId = action.payload;
        },
        setDateRange: (state, action: PayloadAction<{ from: string; to: string } | null>) => {
            state.dateRange = action.payload;
        },
        setHistoryData: (state, action: PayloadAction<any[]>) => {
            state.historyData = action.payload;
        },
        togglePlayback: (state, action: PayloadAction<boolean>) => {
            state.isPlaying = action.payload;
        },
    },
});

export const {
    setSelectedHistoryVehicleId,
    setDateRange,
    setHistoryData,
    togglePlayback
} = historySlice.actions;

export default historySlice.reducer;
