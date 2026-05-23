"use client";

import type { LucideIcon } from "lucide-react";
import {
  Building2,
  History,
  LayoutDashboard,
  Monitor,
  Settings,
  Users,
} from "lucide-react";

export type SuperAdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

export const superAdminNavItems: SuperAdminNavItem[] = [
  {
    label: "Dashboard",
    href: "/superadmin",
    icon: LayoutDashboard,
    description: "Platform oversight & metrics",
  },
  {
    label: "Audit Trail",
    href: "/superadmin/history",
    icon: History,
    description: "Platform activity logs",
  },
  {
    label: "Organizations",
    href: "/superadmin/organizations",
    icon: Building2,
    description: "Client organization records",
  },
  {
    label: "Org Admins",
    href: "/superadmin/users",
    icon: Users,
    description: "Client administrative access",
  },
  {
    label: "Global Inventory",
    href: "/superadmin/gps-devices",
    icon: Monitor,
    description: "Scope-wide hardware oversight",
  },
  {
    label: "System Status",
    href: "/superadmin/settings",
    icon: Settings,
    description: "Environment & context",
  },
];

