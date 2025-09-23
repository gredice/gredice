import { Redis } from '@upstash/redis';

let redis: Redis | null = null;
let cacheDisabled = false;

function cacheClient() {
    if (cacheDisabled) {
        return null;
    }

    const url = process.env.PLANTS_SILO_KV_REST_API_URL;
    const token = process.env.PLANTS_SILO_KV_REST_API_TOKEN;
    if (!url || !token) {
        cacheDisabled = true;
        return null;
    }

    if (!redis) {
        redis = new Redis({
            url,
            token,
        });
    }
    return redis;
}

export const cacheKeys = {
    entity: (entityId: number) => `entity:${entityId}`,
    entityTypeName: (entityTypeName: string) =>
        `entityTypeName:${entityTypeName}`,
};

export async function directoriesCached<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number = 60,
) {
    const client = cacheClient();
    if (!client) {
        return fn();
    }

    const cachedValue = await client.get<T>(key);
    if (cachedValue) {
        try {
            return cachedValue as T;
        } catch (error) {
            console.error(
                `Error parsing cached value for key "${key}":`,
                error,
            );
            await client.del(key);
        }
    }

    const value = await fn();
    await client.set(key, value, { ex: ttl });
    return value;
}

export async function directoriesCachedInfo() {
    try {
        const client = cacheClient();
        if (!client) {
            return null;
        }
        const keys: string[] = [];
        let cursor = '0';

        do {
            const scanResult = await client.scan(cursor);
            cursor = scanResult[0];
            keys.push(...scanResult[1]);
        } while (cursor !== '0');

        return {
            keys,
        };
    } catch (error) {
        console.error('Error fetching Redis info:', error);
        return null;
    }
}

export async function bustCached(key: string) {
    console.debug(`Bust cache for key: ${key}`);
    const client = cacheClient();
    if (!client) {
        return;
    }
    await client.del(key);
}
