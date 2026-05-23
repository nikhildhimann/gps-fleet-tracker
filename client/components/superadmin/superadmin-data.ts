"use client";

export type BasicRecord = Record<string, unknown>;

export const getCollection = <T>(payload: unknown, keys: string[]): T[] => {
  if (!payload || typeof payload !== "object") return [];

  for (const key of keys) {
    const value = (payload as Record<string, unknown>)[key];
    if (Array.isArray(value)) return value as T[];
  }

  return [];
};

export const getDisplayName = (user?: {
  firstName?: string;
  lastName?: string;
  email?: string;
  name?: string;
} | null) => {
  if (!user) return "Super Admin";
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return fullName || user.name || user.email || "Super Admin";
};

export const getInitials = (name?: string | null) => {
  if (!name) return "SA";
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "SA";
  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
};

export const formatStatus = (value?: string | null) => {
  if (!value) return "Unknown";
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export const formatDateTime = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export const getTotalRecords = <T>(payload: unknown, keys: string[]) => {
  if (payload && typeof payload === "object") {
    const pagination = (payload as { pagination?: { totalrecords?: number } }).pagination;
    if (typeof pagination?.totalrecords === "number") return pagination.totalrecords;

    const total = (payload as { total?: number }).total;
    if (typeof total === "number") return total;
  }

  return getCollection<T>(payload, keys).length;
};

export const normalizeSearchValue = (value?: string | null) => value?.trim().toLowerCase() || "";

export const matchesSearch = (search: string, values: Array<string | null | undefined>) => {
  const normalizedSearch = normalizeSearchValue(search);
  if (!normalizedSearch) return true;

  return values.some((value) => normalizeSearchValue(value).includes(normalizedSearch));
};

export const sortByCreatedAtDesc = <T extends { createdAt?: string | null }>(items: T[]) => {
  return [...items].sort((left, right) => {
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return rightTime - leftTime;
  });
};

export const sortByName = <T>(
  items: T[],
  selector: (item: T) => string,
  direction: "asc" | "desc" = "asc",
) => {
  return [...items].sort((left, right) => {
    const leftValue = selector(left).toLowerCase();
    const rightValue = selector(right).toLowerCase();
    const comparison = leftValue.localeCompare(rightValue);
    return direction === "asc" ? comparison : -comparison;
  });
};
