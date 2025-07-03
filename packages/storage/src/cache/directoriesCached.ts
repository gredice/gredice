import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

function cacheClient() {
    if (!redis) {
        redis = new Redis({
            url: process.env.PLANTS_SILO_KV_REST_API_URL,
            token: process.env.PLANTS_SILO_KV_REST_API_TOKEN,
        });
    }
    return redis;
}

export const cacheKeys = {
    entity: (entityId: number) => `entity:${entityId}`,
    entityTypeName: (entityTypeName: string) => `entityTypeName:${entityTypeName}`,
}

export async function directoriesCached<T>(key: string, fn: () => Promise<T>, ttl: number = 60) {
    const client = cacheClient();
    const cachedValue = await client.get<T>(key)
    if (cachedValue) {
        try {
            return cachedValue as T;
        } catch (error) {
            console.error(`Error parsing cached value for key "${key}":`, error);
            // Optionally, you could delete the corrupted cache entry
            await client.del(key);
        }
    }

    if (!cachedValue) {
        const value = await fn();
        await client.set(key, value, { ex: ttl });
        return value;
    }
}

export async function bustCached(key: string) {
    console.debug(`Bust cache for key: ${key}`);
    const client = cacheClient();
    await client.del(key);
}