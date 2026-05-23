import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface OrganizationState {
    selectedOrganizationId: string | null;
    isModalOpen: boolean;
}

const initialState: OrganizationState = {
    selectedOrganizationId: null,
    isModalOpen: false,
};

const organizationSlice = createSlice({
    name: "organization",
    initialState,
    reducers: {
        setSelectedOrganizationId: (state, action: PayloadAction<string | null>) => {
            state.selectedOrganizationId = action.payload;
        },
        toggleModal: (state, action: PayloadAction<boolean>) => {
            state.isModalOpen = action.payload;
        },
    },
});

export const { setSelectedOrganizationId, toggleModal } = organizationSlice.actions;
export default organizationSlice.reducer;
