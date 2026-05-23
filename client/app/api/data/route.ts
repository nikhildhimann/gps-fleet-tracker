import { NextResponse } from "next/server"
import { redis } from "@/lib/redis"
import { DUMMY_DATA } from "@/lib/data"

export async function GET() {
    try {
        // Try to fetch from Redis first
        const cachedData = await redis.get("dashboard_data")

        if (cachedData) {
            return NextResponse.json(JSON.parse(cachedData))
        }

        // If no data in Redis (or connection failed silently), return dummy data
        // In a real app, we might want to set the dummy data into Redis here, 
        // but for this demo, we just serve valid data.
        return NextResponse.json(DUMMY_DATA)
    } catch (error) {
        console.error("Redis Error (harmless if not running):", error)
        // Fallback to dummy data on error
        return NextResponse.json(DUMMY_DATA)
    }
}
