import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

function cacheClient() {
    if (!redis) {
        redis = new Redis({
            url: process.env.GREDICE_SILO_KV_REST_API_URL,
            token: process.env.GREDICE_SILO_KV_REST_API_TOKEN,
        });
    }
    return redis;
}

export const grediceCacheKeys = {
    forecastBjelovar: 'forecastBjelovar',
    airSensorOpgIb: 'airSensorOpgIb',
}

export async function grediceCached<T>(key: string, fn: () => Promise<T>, ttl: number = 60) {
    let client: Redis | null = null;
    let cachedValue: T | null = null;
    try {
        client = cacheClient();
        cachedValue = await client.get<T>(key)
        if (cachedValue) {
            try {
                return cachedValue;
            } catch (error) {
                console.error(`Error parsing cached value for key "${key}":`, error);
                // Optionally, you could delete the corrupted cache entry
                await client.del(key);
            }
        }
    } catch (error) {
        console.warn(`Error accessing cache for key "${key}":`, error);
    }

    if (!cachedValue) {
        const value = await fn();
        try {
            await client?.set(key, value, { ex: ttl });
        } catch (error) {
            console.error(`Error setting cache for key "${key}":`, error);
        }
        return value;
    }
}

export async function grediceCachedInfo() {
    try {
        const client = cacheClient();
        const keys: string[] = [];
        let cursor = "0";

        do {
            const scanResult = await client.scan(cursor);
            cursor = scanResult[0];
            keys.push(...scanResult[1]);
        } while (cursor !== "0");

        return {
            keys
        }
    } catch (error) {
        console.error('Error fetching Redis info:', error);
        return null;
    }
}

export async function bustGrediceCached(key: string) {
    const client = cacheClient();
    await client.del(key);
}