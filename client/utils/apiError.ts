import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";

type ApiErrorData = Record<string, unknown> & {
  message?: unknown;
  error?: unknown;
  errors?: unknown;
  detail?: unknown;
};

const GENERIC_MESSAGES = new Set([
  "operation failed",
  "request failed",
  "service temporarily unavailable",
  "something went wrong",
  "something went wrong. please try again.",
  "failed to fetch",
  "rejected",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toCleanString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
};

const isMeaningfulMessage = (value: unknown): value is string => {
  const message = toCleanString(value);
  if (!message) {
    return false;
  }

  return !GENERIC_MESSAGES.has(message.toLowerCase());
};

const extractValidationMessagesFromValue = (value: unknown): string[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(extractValidationMessagesFromValue);
  }

  if (typeof value === "string") {
    const message = toCleanString(value);
    return message ? [message] : [];
  }

  if (!isRecord(value)) {
    return [];
  }

  const directMessage = toCleanString(value.message);
  if (directMessage) {
    return [directMessage];
  }

  return Object.values(value).flatMap(extractValidationMessagesFromValue);
};

const getErrorData = (error: unknown): ApiErrorData | undefined => {
  if (!isRecord(error) || !("data" in error)) {
    return undefined;
  }

  const { data } = error as { data?: unknown };

  if (isRecord(data)) {
    return data as ApiErrorData;
  }

  if (typeof data === "string") {
    return { message: data };
  }

  return undefined;
};

const getErrorStatus = (error: unknown): number | string | undefined => {
  if (!isRecord(error) || !("status" in error)) {
    return undefined;
  }

  return (error as { status?: number | string }).status;
};

const getTopLevelMessage = (error: unknown): string | null => {
  if (error instanceof Error) {
    return toCleanString(error.message);
  }

  if (!isRecord(error)) {
    return null;
  }

  return toCleanString(error.message) ?? toCleanString(error.error);
};

const getDataMessage = (data?: ApiErrorData): string | null => {
  if (!data) {
    return null;
  }

  if (isMeaningfulMessage(data.message)) {
    return data.message.trim();
  }

  if (isMeaningfulMessage(data.error)) {
    return data.error.trim();
  }

  if (isMeaningfulMessage(data.detail)) {
    return data.detail.trim();
  }

  const validationMessages = extractValidationMessagesFromValue(data.errors);
  return validationMessages[0] ?? null;
};

export const getApiValidationMessages = (error: unknown): string[] => {
  const data = getErrorData(error);
  if (!data?.errors) {
    return [];
  }

  return extractValidationMessagesFromValue(data.errors);
};

export const getApiErrorMessage = (
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string => {
  const data = getErrorData(error);
  const dataMessage = getDataMessage(data);
  if (dataMessage) {
    return dataMessage;
  }

  const topLevelMessage = getTopLevelMessage(error);
  if (isMeaningfulMessage(topLevelMessage)) {
    return topLevelMessage;
  }

  const status = getErrorStatus(error);

  if (status === "FETCH_ERROR") {
    return "Unable to reach the server. Check your connection and try again.";
  }

  if (status === "TIMEOUT_ERROR") {
    return "The request timed out. Please try again.";
  }

  if (status === 401) {
    return "Your session has expired. Please sign in again.";
  }

  if (status === 403) {
    return "You do not have permission to perform this action.";
  }

  if (typeof status === "number" && status >= 500) {
    return "The server returned an error. Please try again.";
  }

  if (typeof status === "number" && status >= 400) {
    return fallback;
  }

  return topLevelMessage || fallback;
};

export const normalizeFetchBaseQueryError = (
  error: FetchBaseQueryError,
  fallback = "Request failed",
): FetchBaseQueryError => {
  const normalizedData =
    typeof error.data === "string"
      ? { message: error.data }
      : isRecord(error.data)
        ? { ...error.data }
        : {};

  const message = getApiErrorMessage(error, fallback);

  return {
    ...error,
    data: {
      ...normalizedData,
      message,
    },
  };
};
