import { fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query";
import { encryptPayload } from "@/utils/encryption";
import { getApiErrorMessage, normalizeFetchBaseQueryError } from "@/utils/apiError";

import { getSecureItem } from "@/app/admin/Helpers/encryptionHelper";

/**
 * -----------------------------------------------------
 * RAW BASE QUERY
 * -----------------------------------------------------
 * - baseUrl = backend root
 * - Authorization header ONLY when token exists
 * - NO auth header on login
 */
const rawBaseQuery = fetchBaseQuery({
  baseUrl: "http://localhost:5000/api",

  prepareHeaders: (headers, { endpoint }) => {
    // ❌ login endpoint pe token nahi bhejna
    if (endpoint === "login") {
      return headers;
    }

    if (typeof window !== "undefined") {
      const token = getSecureItem("token");
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    }

    return headers;
  },
});

/**
 * -----------------------------------------------------
 * BASE QUERY WRAPPER
 * -----------------------------------------------------
 * Admin CRUD flows should surface the real backend message and must not be
 * blocked by shared frontend circuit state, so we normalize errors here
 * without rewriting them to a generic synthetic 503.
 * -----------------------------------------------------
 */
export const baseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  try {
    const result = await rawBaseQuery(args, api, extraOptions);

    if (result.error) {
      return {
        error: normalizeFetchBaseQueryError(result.error, "Request failed"),
      };
    }

    return result;
  } catch (err) {
    return {
      error: {
        status: "CUSTOM_ERROR",
        error: err instanceof Error ? err.message : "Unexpected frontend error",
        data: {
          message: getApiErrorMessage(err, "Unexpected frontend error"),
        },
      } as FetchBaseQueryError,
    };
  }
};

/**
 * -----------------------------------------------------
 * GENERIC API HELPERS
 * -----------------------------------------------------
 * NOTE:
 * ❌ NEVER encrypt login / auth APIs
 * ✅ encrypt only sensitive create/update APIs if needed
 */

export const apiGet = (url: string) => ({
  url,
  method: "GET",
});

export const apiPost = <T>(
  url: string,
  body: T,
  options?: { encrypt?: boolean }
) => ({
  url,
  method: "POST",
  body: options?.encrypt ? { data: encryptPayload(body) } : body,
});

export const apiPut = <T>(
  url: string,
  body: T,
  options?: { encrypt?: boolean }
) => ({
  url,
  method: "PUT",
  body: options?.encrypt ? { data: encryptPayload(body) } : body,
});

export const apiDelete = (url: string) => ({
  url,
  method: "DELETE",
});
