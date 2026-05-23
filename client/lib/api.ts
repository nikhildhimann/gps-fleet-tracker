/**
 * lib/api.ts
 * Centralized API service layer for the dashboard.
 * All functions call the real backend at http://localhost:5000/api
 */

import { getSecureItem } from "@/app/admin/Helpers/encryptionHelper"

const BASE_URL = "http://localhost:5000/api"

function authHeaders(): HeadersInit {
    const token = getSecureItem("token")
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
}

async function handleResponse<T>(res: Response): Promise<T> {
    const json = await res.json()
    if (!res.ok) {
        throw new Error(json?.message || `Request failed: ${res.status}`)
    }
    return json as T
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export interface UserProfile {
    _id: string
    firstName: string
    lastName: string
    email: string
    mobile?: string
    role: string
    status: string
    organizationId?: { _id: string; name: string; email?: string }
    assignedVehicleId?: string | { _id: string; vehicleNumber?: string }
}

export async function getProfile(): Promise<UserProfile> {
    const res = await fetch(`${BASE_URL}/users/me`, { headers: authHeaders() })
    const json = await handleResponse<{ data: UserProfile }>(res)
    return json.data
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export interface DashboardStats {
    organizations: number
    vehicles: number
}

export async function getStats(): Promise<DashboardStats> {
    // Pull stats from individual list-endpoints (real backend has no dedicated /dashboard/stats)
    const [orgsRes, vehsRes] = await Promise.all([
        fetch(`${BASE_URL}/organizations`, { headers: authHeaders() }),
        fetch(`${BASE_URL}/vehicle`, { headers: authHeaders() }),
    ])
    const orgsJson = await orgsRes.json()
    const vehsJson = await vehsRes.json()
    const orgs: unknown[] = orgsJson?.organizations || orgsJson?.data || []
    const vehs: unknown[] = vehsJson?.vehicles || vehsJson?.data || []
    return { organizations: orgs.length, vehicles: vehs.length }
}

// ─── Vehicles (paginated) ─────────────────────────────────────────────────────

export interface VehicleRecord {
    _id: string
    vehicleNumber?: string
    registrationNumber?: string
    imei?: string
    deviceImei?: string
    status?: string
    currentLocation?: {
        address?: string
        latitude?: number
        longitude?: number
    }
    organizationId?: string | { _id: string; name?: string }
    driverName?: string
    make?: string
    model?: string
    vehicleType?: string
    color?: string
    year?: string
}

export interface VehicleListResponse {
    data: VehicleRecord[]
    total: number
    page: number
    totalPages: number
}

export async function getVehicles(params?: {
    page?: number
    limit?: number
    status?: string
}): Promise<VehicleListResponse> {
    const query = new URLSearchParams()
    if (params?.page) query.set("page", String(params.page))
    if (params?.limit) query.set("limit", String(params.limit))
    if (params?.status) query.set("status", params.status)

    const res = await fetch(`${BASE_URL}/vehicle?${query.toString()}`, {
        headers: authHeaders(),
    })
    const json = await res.json()
    const items: VehicleRecord[] = json?.vehicles || json?.data || []
    return {
        data: items,
        total: json?.total ?? items.length,
        page: json?.page ?? 1,
        totalPages: json?.totalPages ?? 1,
    }
}

export async function updateVehicle(
    id: string,
    body: Partial<VehicleRecord>
): Promise<VehicleRecord> {
    const res = await fetch(`${BASE_URL}/vehicle/${id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(body),
    })
    const json = await handleResponse<{ data: VehicleRecord }>(res)
    return json.data
}

export async function deleteVehicle(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/vehicle/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
    })
    if (!res.ok) {
        const json = await res.json()
        throw new Error(json?.message || "Delete failed")
    }
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface NotificationItem {
    _id: string
    alertName?: string
    message?: string
    severity?: string
    acknowledged?: boolean
    createdAt?: string
    gpsTimestamp?: string
    receivedAt?: string
}

export async function getNotifications(): Promise<NotificationItem[]> {
    const res = await fetch(`${BASE_URL}/alerts`, { headers: authHeaders() })
    const json = await res.json()
    return json?.data || json?.alerts || []
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logoutUser(): Promise<void> {
    try {
        await fetch(`${BASE_URL}/users/logout`, {
            method: "POST",
            headers: authHeaders(),
        })
    } catch {
        // Fail silently — we always clear local state
    }
}
