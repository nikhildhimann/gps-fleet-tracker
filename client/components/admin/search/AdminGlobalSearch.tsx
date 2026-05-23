"use client";

import clsx from "clsx";
import {
  Building2,
  Car,
  ChevronRight,
  Command,
  Link2,
  MapPinned,
  Radio,
  Search,
  Users,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useGetDriversQuery } from "@/redux/api/driversApi";
import { useGetGpsDevicesQuery } from "@/redux/api/gpsDeviceApi";
import {
  useGetOrganizationsQuery,
  useGetSubOrganizationsQuery,
} from "@/redux/api/organizationApi";
import { useGetUsersQuery } from "@/redux/api/usersApi";
import { useGetVehiclesQuery } from "@/redux/api/vehicleApi";
import { useOrgContext } from "@/hooks/useOrgContext";

type SearchGroupId =
  | "quick-actions"
  | "organizations"
  | "vehicles"
  | "gps-devices"
  | "users"
  | "drivers";

type SearchResultItem = {
  id: string;
  group: SearchGroupId;
  title: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
  badge: string;
};

type SearchResultGroup = {
  id: SearchGroupId;
  label: string;
  items: SearchResultItem[];
};

type OrganizationRecord = {
  _id: string;
  name?: string;
  email?: string;
  status?: string;
  parentOrganizationId?: string | null;
};

type VehicleRecord = {
  _id: string;
  vehicleNumber?: string;
  registrationNumber?: string;
  model?: string;
  vehicleType?: string;
  status?: string;
};

type DeviceRecord = {
  _id: string;
  imei?: string;
  deviceModel?: string;
  model?: string;
  simNumber?: string;
  status?: string;
  connectionStatus?: string;
};

type UserRecord = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  mobile?: string;
  role?: string;
  status?: string;
};

type DriverRecord = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  licenseNumber?: string;
  status?: string;
};

const MAX_RESULTS_PER_GROUP = 4;

const normalize = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const toLabel = (value?: string | null) => {
  if (!value) return "—";
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const matchesQuery = (query: string, values: Array<string | null | undefined>) =>
  values.some((value) => normalize(value).includes(query));

const buildUserName = (record: {
  firstName?: string;
  lastName?: string;
  email?: string;
}) => {
  const fullName = [record.firstName, record.lastName].filter(Boolean).join(" ").trim();
  return fullName || record.email || "Unnamed";
};

export default function AdminGlobalSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const { isSuperAdmin, isRootOrgAdmin } = useOrgContext();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [isDesktopOpen, setIsDesktopOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  const isOpen = isDesktopOpen || isMobileOpen;
  const normalizedQuery = normalize(deferredQuery);
  const hasSearchText = normalizedQuery.length >= 2;

  const { data: orgData, isFetching: isFetchingOrganizations } = useGetOrganizationsQuery(
    { page: 0, limit: 1000 },
    { skip: !isOpen || !hasSearchText, refetchOnMountOrArgChange: true },
  );
  const { data: subOrgData, isFetching: isFetchingSubOrganizations } = useGetSubOrganizationsQuery(
    { page: 0, limit: 1000 },
    { skip: !isOpen || !hasSearchText, refetchOnMountOrArgChange: true },
  );
  const { data: vehicleData, isFetching: isFetchingVehicles } = useGetVehiclesQuery(
    { page: 0, limit: 1000 },
    { skip: !isOpen || !hasSearchText, refetchOnMountOrArgChange: true },
  );
  const { data: deviceData, isFetching: isFetchingDevices } = useGetGpsDevicesQuery(
    { page: 0, limit: 1000 },
    { skip: !isOpen || !hasSearchText, refetchOnMountOrArgChange: true },
  );
  const { data: userData, isFetching: isFetchingUsers } = useGetUsersQuery(
    { page: 0, limit: 1000 },
    { skip: !isOpen || !hasSearchText, refetchOnMountOrArgChange: true },
  );
  const { data: driverData, isFetching: isFetchingDrivers } = useGetDriversQuery(
    { page: 0, limit: 1000 },
    { skip: !isOpen || !hasSearchText, refetchOnMountOrArgChange: true },
  );

  const organizations = useMemo(() => {
    const root = ((orgData?.data as OrganizationRecord[]) || []);
    const sub = ((subOrgData?.data as OrganizationRecord[]) || []);
    const merged = new Map<string, OrganizationRecord>();

    [...root, ...sub].forEach((item) => {
      if (item?._id) merged.set(item._id, item);
    });

    return Array.from(merged.values());
  }, [orgData, subOrgData]);

  const vehicles = useMemo(
    () => ((vehicleData?.data as VehicleRecord[]) || []),
    [vehicleData],
  );
  const devices = useMemo(
    () => ((deviceData?.data as DeviceRecord[]) || []),
    [deviceData],
  );
  const users = useMemo(() => {
    const data = userData as { data?: UserRecord[]; users?: UserRecord[] } | undefined;
    return data?.data || data?.users || [];
  }, [userData]);
  const drivers = useMemo(
    () => ((driverData?.data as DriverRecord[]) || []),
    [driverData],
  );

  const quickActions = useMemo<SearchResultItem[]>(() => {
    const actions: SearchResultItem[] = [
      {
        id: "dashboard",
        group: "quick-actions",
        title: "Dashboard",
        subtitle: "Open the admin operations dashboard",
        href: "/admin",
        icon: MapPinned,
        badge: "Page",
      },
      {
        id: "live-tracking",
        group: "quick-actions",
        title: "Live Tracking",
        subtitle: "Jump to real-time fleet visibility",
        href: "/admin/live-tracking",
        icon: MapPinned,
        badge: "Page",
      },
      {
        id: "vehicles",
        group: "quick-actions",
        title: "Vehicles",
        subtitle: "Open the vehicle management workspace",
        href: "/admin/vehicles",
        icon: Car,
        badge: "Page",
      },
      {
        id: "gps-devices",
        group: "quick-actions",
        title: "GPS Devices",
        subtitle: "Manage connected hardware and inventory",
        href: "/admin/gps-devices",
        icon: Radio,
        badge: "Page",
      },
      {
        id: "users",
        group: "quick-actions",
        title: "Users",
        subtitle: "Manage admin and driver access",
        href: "/admin/users",
        icon: Users,
        badge: "Page",
      },
      {
        id: "drivers",
        group: "quick-actions",
        title: "Drivers",
        subtitle: "Open driver records and assignments",
        href: "/admin/drivers",
        icon: UserRound,
        badge: "Page",
      },
      {
        id: "device-mapping",
        group: "quick-actions",
        title: "Device Mapping",
        subtitle: "Map devices to vehicles",
        href: "/admin/device-mapping",
        icon: Link2,
        badge: "Page",
      },
      {
        id: "driver-mapping",
        group: "quick-actions",
        title: "Driver Mapping",
        subtitle: "Map drivers to vehicles",
        href: "/admin/driver-mapping",
        icon: Link2,
        badge: "Page",
      },
    ];

    if (isSuperAdmin || isRootOrgAdmin) {
      actions.splice(2, 0, {
        id: "organizations",
        group: "quick-actions",
        title: "Organizations",
        subtitle: "Browse organization records and hierarchy",
        href: "/admin/organizations",
        icon: Building2,
        badge: "Page",
      });
    }

    return actions;
  }, [isRootOrgAdmin, isSuperAdmin]);

  const resultGroups = useMemo<SearchResultGroup[]>(() => {
    if (!hasSearchText) {
      return [
        {
          id: "quick-actions",
          label: "Quick Actions",
          items: quickActions.slice(0, 6),
        },
      ];
    }

    const organizationItems = organizations
      .filter((item) => matchesQuery(normalizedQuery, [item.name]))
      .slice(0, MAX_RESULTS_PER_GROUP)
      .map<SearchResultItem>((item) => ({
        id: item._id,
        group: "organizations",
        title: item.name || "Organization",
        subtitle: ["Organization", toLabel(item.status)].filter((value) => value && value !== "—").join(" • "),
        href: `/admin/organizations?search=${encodeURIComponent(item.name || "")}`,
        icon: Building2,
        badge: "Organization",
      }));

    const vehicleItems = vehicles
      .filter((item) =>
        matchesQuery(normalizedQuery, [
          item.vehicleNumber,
          item.registrationNumber,
          item.model,
          item.vehicleType,
        ]),
      )
      .slice(0, MAX_RESULTS_PER_GROUP)
      .map<SearchResultItem>((item) => ({
        id: item._id,
        group: "vehicles",
        title: item.vehicleNumber || item.registrationNumber || "Vehicle",
        subtitle: ["Vehicle", item.model, toLabel(item.status)].filter(Boolean).join(" • "),
        href: `/admin/vehicles?search=${encodeURIComponent(item.vehicleNumber || item.registrationNumber || item.model || "")}`,
        icon: Car,
        badge: "Vehicle",
      }));

    const deviceItems = devices
      .filter((item) =>
        matchesQuery(normalizedQuery, [
          item.imei,
          item.deviceModel,
          item.model,
          item.simNumber,
        ]),
      )
      .slice(0, MAX_RESULTS_PER_GROUP)
      .map<SearchResultItem>((item) => ({
        id: item._id,
        group: "gps-devices",
        title: item.imei || "GPS Device",
        subtitle: ["GPS Device", item.deviceModel || item.model, item.simNumber ? `SIM ${item.simNumber}` : ""]
          .filter(Boolean)
          .join(" • "),
        href: `/admin/gps-devices?search=${encodeURIComponent(item.imei || item.deviceModel || item.model || "")}`,
        icon: Radio,
        badge: "GPS Device",
      }));

    const userItems = users
      .filter((item) =>
        matchesQuery(normalizedQuery, [
          item.firstName,
          item.lastName,
          item.email,
          item.mobile,
        ]),
      )
      .slice(0, MAX_RESULTS_PER_GROUP)
      .map<SearchResultItem>((item) => ({
        id: item._id,
        group: "users",
        title: buildUserName(item),
        subtitle: ["User", toLabel(item.role), item.email || item.mobile || ""]
          .filter(Boolean)
          .join(" • "),
        href: `/admin/users?search=${encodeURIComponent(item.email || buildUserName(item))}`,
        icon: Users,
        badge: "User",
      }));

    const driverItems = drivers
      .filter((item) =>
        matchesQuery(normalizedQuery, [
          item.firstName,
          item.lastName,
          item.email,
          item.phone,
          item.licenseNumber,
        ]),
      )
      .slice(0, MAX_RESULTS_PER_GROUP)
      .map<SearchResultItem>((item) => ({
        id: item._id,
        group: "drivers",
        title: buildUserName(item),
        subtitle: ["Driver", toLabel(item.status), item.phone || item.licenseNumber || ""]
          .filter(Boolean)
          .join(" • "),
        href: `/admin/drivers?search=${encodeURIComponent(item.phone || buildUserName(item))}`,
        icon: UserRound,
        badge: "Driver",
      }));

    return [
      { id: "organizations", label: "Organizations", items: organizationItems },
      { id: "vehicles", label: "Vehicles", items: vehicleItems },
      { id: "gps-devices", label: "GPS Devices", items: deviceItems },
      { id: "users", label: "Users", items: userItems },
      { id: "drivers", label: "Drivers", items: driverItems },
    ].filter((group) => group.items.length > 0);
  }, [devices, drivers, hasSearchText, normalizedQuery, organizations, quickActions, users, vehicles]);

  const isLoading =
    isFetchingOrganizations ||
    isFetchingSubOrganizations ||
    isFetchingVehicles ||
    isFetchingDevices ||
    isFetchingUsers ||
    isFetchingDrivers;

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideDesktop = containerRef.current?.contains(target);
      const insideMobile = mobilePanelRef.current?.contains(target);

      if (!insideDesktop && !insideMobile) {
        setIsDesktopOpen(false);
        setIsMobileOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsMobileOpen(false);
        setIsDesktopOpen(true);
        requestAnimationFrame(() => desktopInputRef.current?.focus());
      }

      if (event.key === "Escape") {
        setIsDesktopOpen(false);
        setIsMobileOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!isMobileOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    requestAnimationFrame(() => mobileInputRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileOpen]);

  const handleSelect = (href: string) => {
    setIsDesktopOpen(false);
    setIsMobileOpen(false);

    const targetPath = href.split("?")[0];
    if (targetPath === pathname) {
      window.location.assign(href);
      return;
    }

    router.push(href);
  };

  const panelContent = (
    <SearchResultsPanel
      isLoading={hasSearchText && isLoading}
      query={query}
      groups={resultGroups}
      onSelect={handleSelect}
    />
  );

  return (
    <>
      <div ref={containerRef} className="relative hidden w-full min-w-0 max-w-full md:block md:max-w-lg lg:max-w-2xl">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={desktopInputRef}
            type="text"
            value={query}
            onFocus={() => setIsDesktopOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsDesktopOpen(true);
            }}
            placeholder="Search organizations, vehicles, devices, users..."
            className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-20 py-3 text-sm font-semibold text-slate-700 shadow-sm transition placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
          />
          <div className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            <Command className="h-3 w-3" />
            <span>K</span>
          </div>
        </div>

        {isDesktopOpen ? (
          <div className="absolute left-0 right-0 top-full z-50 mt-3 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_22px_48px_rgba(15,23,42,0.18)]">
            {panelContent}
          </div>
        ) : null}
      </div>

      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
          aria-label="Open global search"
        >
          <Search className="h-4 w-4" />
          <span>Search</span>
        </button>
      </div>

      {isMobileOpen ? (
        <div className="fixed inset-0 z-[70] md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]"
            onClick={() => setIsMobileOpen(false)}
            aria-label="Close search"
          />

          <div
            ref={mobilePanelRef}
            className="absolute inset-x-3 top-20 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]"
          >
            <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  ref={mobileInputRef}
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search vehicles, devices, users..."
                  className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 py-3 text-sm font-semibold text-slate-700 outline-none transition placeholder-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
                aria-label="Close search"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {panelContent}
          </div>
        </div>
      ) : null}
    </>
  );
}

function SearchResultsPanel({
  isLoading,
  query,
  groups,
  onSelect,
}: {
  isLoading: boolean;
  query: string;
  groups: SearchResultGroup[];
  onSelect: (href: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-2xl border border-slate-200 bg-slate-50"
          />
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="px-5 py-10 text-center">
        <Search className="mx-auto h-8 w-8 text-slate-300" />
        <h3 className="mt-3 text-sm font-black text-slate-900">No matching results</h3>
        <p className="mt-1 text-sm font-medium text-slate-500">
          No organizations, vehicles, devices, users, or drivers matched &quot;{query}&quot;.
        </p>
      </div>
    );
  }

  return (
    <div className="max-h-[min(32rem,calc(100dvh-9rem))] overflow-y-auto">
      {groups.map((group, index) => (
        <div key={group.id} className={clsx(index > 0 && "border-t border-slate-200")}>
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
            {group.label}
          </div>
          <div className="p-2">
            {group.items.map((item) => (
              <SearchResultRow key={`${item.group}-${item.id}`} item={item} onSelect={onSelect} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SearchResultRow({
  item,
  onSelect,
}: {
  item: SearchResultItem;
  onSelect: (href: string) => void;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={() => onSelect(item.href)}
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-slate-50"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold text-slate-900">{item.title}</p>
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            {item.badge}
          </span>
        </div>
        <p className="truncate text-xs font-medium text-slate-500">{item.subtitle}</p>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
    </button>
  );
}
