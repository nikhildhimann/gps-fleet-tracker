import Redis from "ioredis"

const globalForRedis = global as unknown as { redis: Redis }

export const redis =
    globalForRedis.redis ||
    new Redis({
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        password: process.env.REDIS_PASSWORD,
        // Provide a fail-safe so the app doesn't crash if Redis is missing locally
        retryStrategy: (times) => {
            if (times > 3) {
                console.warn("Redis connection failed, falling back to in-memory/dummy data.")
                return null // Stop retrying
            }
            return Math.min(times * 50, 2000)
        },
        lazyConnect: true // Don't crash on boot
    })

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis
