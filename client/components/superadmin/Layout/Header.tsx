"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, Plus, Search, type LucideIcon, Building2, Users } from "lucide-react";
import { useGetMeQuery, useGetUsersQuery } from "@/redux/api/usersApi";
import { useGetOrganizationsQuery } from "@/redux/api/organizationApi";
import { getCollection, getDisplayName, getInitials } from "@/components/superadmin/superadmin-data";
import { superAdminNavItems } from "./navigation";

type HeaderProps = {
  onOpenSidebar?: () => void;
};

type SearchItem = {
  id: string;
  label: string;
  meta: string;
  href: string;
  icon: LucideIcon;
  keywords: string[];
};

export default function Header({ onOpenSidebar }: HeaderProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { data: meData } = useGetMeQuery(undefined);
  const { data: orgData } = useGetOrganizationsQuery({ page: 0, limit: 1000 });
  const { data: usersData } = useGetUsersQuery({ page: 0, limit: 1000, role: "admin" });

  const me = meData?.data;
  const displayName = getDisplayName(me);
  const initials = getInitials(displayName);

  const searchCatalog = useMemo(() => {
    const organizations = getCollection<{ _id: string; name?: string; email?: string }>(
      orgData,
      ["data", "docs", "organizations"],
    );
    const users = getCollection<{ _id: string; firstName?: string; lastName?: string; email?: string; role?: string }>(
      usersData,
      ["data", "docs", "users"],
    );

    const navItems: SearchItem[] = superAdminNavItems.map((item) => ({
      id: item.href,
      label: item.label,
      meta: "Section",
      href: item.href,
      icon: item.icon,
      keywords: [item.label, item.description, item.href],
    }));

    const orgItems: SearchItem[] = organizations.map((org) => ({
      id: org._id,
      label: org.name || "Organization",
      meta: org.email || "Organization",
      href: "/superadmin/organizations",
      icon: Building2,
      keywords: [org._id, org.name || "", org.email || ""],
    }));

    const userItems: SearchItem[] = users.map((user) => {
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email || "Organization Admin";
      return {
        id: user._id,
        label: name,
        meta: [user.role, user.email].filter(Boolean).join(" • ") || "Organization admin",
        href: "/superadmin/users",
        icon: Users,
        keywords: [user._id, name, user.email || "", user.role || ""],
      };
    });

    return [...navItems, ...orgItems, ...userItems];
  }, [orgData, usersData]);

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return searchCatalog;
    return searchCatalog.filter((item) =>
      item.keywords.some((keyword) => keyword.toLowerCase().includes(trimmed)),
    );
  }, [query, searchCatalog]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearch(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="fixed left-0 right-0 top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 px-3 py-3 backdrop-blur-xl sm:px-4 lg:left-72 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-slate-300 transition hover:bg-slate-800 lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu size={18} />
        </button>

        <div ref={searchRef} className="relative min-w-0 max-w-full flex-1 lg:max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search organizations and org admins..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-10 pr-4 text-sm font-semibold text-slate-200 transition placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setShowSearch(true);
            }}
            onFocus={() => setShowSearch(true)}
            onBlur={() => {
              setTimeout(() => setShowSearch(false), 120);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && results[0]) {
                router.push(results[0].href);
                setShowSearch(false);
              }
            }}
          />
          {showSearch ? (
            <div className="absolute left-0 right-0 top-12 rounded-2xl border border-slate-800 bg-slate-950/95 p-2 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.9)]">
              <p className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                Global Search
              </p>
              <div className="max-h-72 overflow-y-auto">
                {results.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      router.push(item.href);
                      setShowSearch(false);
                    }}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-200 hover:bg-slate-900"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-slate-400">
                        <item.icon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{item.label}</div>
                        <div className="truncate text-[10px] uppercase tracking-widest text-slate-500">{item.meta}</div>
                      </div>
                    </div>
                  </button>
                ))}
                {results.length === 0 ? (
                  <p className="px-3 py-3 text-xs font-semibold text-slate-500">No matches found.</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/superadmin/organizations?action=create")}
            className="hidden rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-emerald-200 transition hover:bg-emerald-500/25 sm:inline-flex sm:items-center sm:gap-2"
          >
            <Plus size={14} />
            Add Organization
          </button>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-2.5 py-2">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-white">{displayName}</p>
              <p className="text-xs text-slate-400">{me?.email || "superadmin"}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500 text-sm font-black text-slate-950">
              {initials}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
