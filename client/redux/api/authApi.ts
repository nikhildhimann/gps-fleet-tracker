// redux/api/authApi.ts
import { baseApi } from "./baseApi";
import { apiPost } from "./commonApi";
import { API_ROUTES } from "@/constants/ApiRoutes";


import { saveSecureItem } from "@/app/admin/Helpers/encryptionHelper";


// 🔐 ORG CONTEXT UPDATE
type LoginResponse = {
  token: string;
  user: {
    _id: string;
    role: "superadmin" | "admin" | "driver";
    organizationId: string | null;
    organizationName?: string;
    organizationPath?: string;
    firstName?: string;
    lastName?: string;
  };
};

export const authApi = baseApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    login: builder.mutation<
      LoginResponse,
      { email: string; password: string }
    >({

      query: (body) => ({
        url: API_ROUTES.LOGIN, // "/login"
        method: "POST",
        body,
      }),


      async onQueryStarted(arg, { queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;

          // 🔐 ORG CONTEXT UPDATE
          if (typeof window !== "undefined") {
            saveSecureItem("token", data.token);
            saveSecureItem("userRole", data.user.role);
            saveSecureItem("user", data.user);
          }

        } catch (err) {
          console.error("Login failed");
        }
      },
    }),
  }),
});

export const { useLoginMutation } = authApi;
