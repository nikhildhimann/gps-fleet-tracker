"use client";

export type AdminProfileOrganization = {
  _id?: string;
  name?: string;
  logo?: string | null;
  parentOrganizationId?: string | null;
  email?: string;
};

export type AdminProfileUser = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  mobile?: string;
  role?: string;
  status?: string;
  organizationId?: string | AdminProfileOrganization | null;
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string;
  lastLoginAt?: string;
  lastSeen?: string;
  organizationName?: string;
  organizationPath?: string;
};

export const getDisplayName = (user?: AdminProfileUser | null) => {
  if (!user) return "—";

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return fullName || user.email || "Admin User";
};

export const getInitials = (user?: AdminProfileUser | null) => {
  if (!user) return "AU";

  const parts = [user.firstName, user.lastName]
    .filter(Boolean)
    .map((part) => part!.trim()[0]?.toUpperCase())
    .filter(Boolean);

  if (parts.length > 0) return parts.slice(0, 2).join("");
  if (user.email) return user.email.slice(0, 2).toUpperCase();
  return "AU";
};

export const getRoleLabel = (role?: string | null) => {
  if (!role) return "—";
  return role
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export const getOrganizationDetails = (
  organization: AdminProfileUser["organizationId"],
  fallbackName?: string,
) => {
  if (organization && typeof organization === "object") {
    return {
      id: organization._id || null,
      name: organization.name || fallbackName || "Organization",
      logo: organization.logo || null,
      parentOrganizationId: organization.parentOrganizationId || null,
      email: organization.email || null,
    };
  }

  return {
    id: typeof organization === "string" ? organization : null,
    name: fallbackName || "Organization",
    logo: null,
    parentOrganizationId: null,
    email: null,
  };
};

export const getStatusTone = (status?: string | null) => {
  const normalized = (status || "").toLowerCase();
  if (normalized === "active" || normalized === "online") return "success" as const;
  if (normalized === "inactive" || normalized === "offline") return "danger" as const;
  if (normalized === "pending" || normalized === "suspended") return "warning" as const;
  return "neutral" as const;
};

export const getStatusLabel = (status?: string | null) => {
  if (!status) return "Unknown";
  return getRoleLabel(status);
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

export const getWorkspaceDescriptor = ({
  role,
  parentOrganizationId,
}: {
  role?: string | null;
  parentOrganizationId?: string | null;
}) => {
  if (role === "superadmin") return "Platform Workspace";
  if (role === "admin" && !parentOrganizationId) return "Admin Workspace";
  if (role === "admin" && parentOrganizationId) return "Sub-organization Workspace";
  return "Operational Workspace";
};

