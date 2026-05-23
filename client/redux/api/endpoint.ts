import { baseApi } from "./baseApi";

const dummyProducts = [
  {
    id: "p1",
    name: "USDT Package",
    price: 10,
  },
  {
    id: "p2",
    name: "TRC20 Deposit",
    price: 50,
  },
  {
    id: "p3",
    name: "Premium Order",
    price: 100,
  },
];

export const api = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // GPS Tracker Endpoints will replace these
  }),
});

// GPS Tracker Endpoints will be in separate files

