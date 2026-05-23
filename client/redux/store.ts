import { configureStore } from "@reduxjs/toolkit";
import { baseApi } from "./api/baseApi";

import userReducer from "./features/userSlice";
import organizationReducer from "./features/organizationSlice";
import vehicleReducer from "./features/vehicleSlice";
import gpsDeviceReducer from "./features/gpsDeviceSlice";
import liveTrackingReducer from "./features/liveTrackingSlice";
import historyReducer from "./features/historySlice";

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    user: userReducer,
    organization: organizationReducer,
    vehicle: vehicleReducer,
    gpsDevice: gpsDeviceReducer,
    liveTracking: liveTrackingReducer,
    history: historyReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(baseApi.middleware),
});

// types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
