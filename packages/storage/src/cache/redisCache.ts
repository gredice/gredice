import { Redis } from '@upstash/redis';

export type RedisCacheNamespace = 'plants' | 'gredice';

type RedisCacheOptions = {
    namespace?: RedisCacheNamespace;
    ttl?: number;
    jitterRatio?: number;
    maxPayloadBytes?: number;
};

type RedisCacheEnvelope = {
    __grediceCacheEnvelope: 'v1';
    value: unknown;
};

const DEFAULT_TTL_SECONDS = 60;
const DEFAULT_JITTER_RATIO = 0.15;
const DEFAULT_MAX_PAYLOAD_BYTES = 512 * 1024;
const CACHE_DATE_KEY = '__grediceCacheDate';

const redisClients: Partial<Record<RedisCacheNamespace, Redis>> = {};
const disabledNamespaces = new Set<RedisCacheNamespace>();
const inFlightCacheMisses = new Map<string, Promise<unknown>>();

function cacheCredentials(namespace: RedisCacheNamespace) {
    if (namespace === 'gredice') {
        return {
            url: process.env.GREDICE_SILO_KV_REST_API_URL,
            token: process.env.GREDICE_SILO_KV_REST_API_TOKEN,
        };
    }

    return {
        url: process.env.PLANTS_SILO_KV_REST_API_URL,
        token: process.env.PLANTS_SILO_KV_REST_API_TOKEN,
    };
}

export function redisCacheClient(
    namespace: RedisCacheNamespace = 'plants',
): Redis | null {
    if (disabledNamespaces.has(namespace)) {
        return null;
    }

    const existingClient = redisClients[namespace];
    if (existingClient) {
        return existingClient;
    }

    const { url, token } = cacheCredentials(namespace);
    if (!url || !token) {
        disabledNamespaces.add(namespace);
        return null;
    }

    const client = new Redis({
        url,
        token,
    });
    redisClients[namespace] = client;
    return client;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function serializeCacheValue(value: unknown): unknown {
    if (value instanceof Date) {
        return {
            [CACHE_DATE_KEY]: value.toISOString(),
        };
    }

    if (Array.isArray(value)) {
        return value.map(serializeCacheValue);
    }

    if (!isRecord(value)) {
        return value;
    }

    const serialized: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
        serialized[key] = serializeCacheValue(item);
    }
    return serialized;
}

function deserializeCacheValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(deserializeCacheValue);
    }

    if (!isRecord(value)) {
        return value;
    }

    const dateValue = value[CACHE_DATE_KEY];
    if (typeof dateValue === 'string') {
        const date = new Date(dateValue);
        return Number.isNaN(date.getTime()) ? dateValue : date;
    }

    const deserialized: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
        deserialized[key] = deserializeCacheValue(item);
    }
    return deserialized;
}

function cacheEnvelope(value: unknown): RedisCacheEnvelope {
    return {
        __grediceCacheEnvelope: 'v1',
        value: serializeCacheValue(value),
    };
}

function isCacheEnvelope(value: unknown): value is RedisCacheEnvelope {
    return (
        isRecord(value) &&
        value.__grediceCacheEnvelope === 'v1' &&
        'value' in value
    );
}

function ttlWithJitter(ttl: number, jitterRatio: number) {
    const jitter = Math.floor(ttl * jitterRatio);
    if (jitter <= 0) {
        return Math.max(1, ttl);
    }

    const offset = Math.floor(Math.random() * (jitter * 2 + 1)) - jitter;
    return Math.max(1, ttl + offset);
}

export async function redisCached<T>(
    key: string,
    fn: () => Promise<T>,
    options: RedisCacheOptions = {},
): Promise<T> {
    const namespace = options.namespace ?? 'plants';
    const client = redisCacheClient(namespace);
    if (!client) {
        return fn();
    }

    const inFlightKey = `${namespace}:${key}`;
    const pending = inFlightCacheMisses.get(inFlightKey);
    if (pending) {
        return pending as Promise<T>;
    }

    const promise = (async () => {
        try {
            const cachedValue = await client.get<RedisCacheEnvelope>(key);
            if (isCacheEnvelope(cachedValue)) {
                return deserializeCacheValue(cachedValue.value) as T;
            }

            if (cachedValue !== null) {
                await client.del(key);
            }
        } catch (error) {
            console.warn(`Error reading Redis cache for key "${key}":`, error);
        }

        const value = await fn();
        if (typeof value === 'undefined') {
            return value;
        }

        try {
            const envelope = cacheEnvelope(value);
            const payload = JSON.stringify(envelope);
            const maxPayloadBytes =
                options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES;

            if (Buffer.byteLength(payload) <= maxPayloadBytes) {
                await client.set(key, envelope, {
                    ex: ttlWithJitter(
                        options.ttl ?? DEFAULT_TTL_SECONDS,
                        options.jitterRatio ?? DEFAULT_JITTER_RATIO,
                    ),
                });
            }
        } catch (error) {
            console.warn(`Error setting Redis cache for key "${key}":`, error);
        }

        return value;
    })();

    inFlightCacheMisses.set(inFlightKey, promise);
    try {
        return (await promise) as T;
    } finally {
        inFlightCacheMisses.delete(inFlightKey);
    }
}

export async function redisCachedInfo(
    namespace: RedisCacheNamespace = 'plants',
) {
    try {
        const client = redisCacheClient(namespace);
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

export async function bustRedisCached(
    key: string,
    namespace: RedisCacheNamespace = 'plants',
) {
    try {
        const client = redisCacheClient(namespace);
        if (!client) {
            return;
        }

        await client.del(key);
    } catch (error) {
        console.warn(`Error busting Redis cache for key "${key}":`, error);
    }
}

export async function bustRedisCacheByPrefixes(
    prefixes: string[],
    namespace: RedisCacheNamespace = 'plants',
) {
    try {
        const client = redisCacheClient(namespace);
        if (!client || prefixes.length === 0) {
            return [];
        }

        const keys: string[] = [];
        let cursor = '0';

        do {
            const scanResult = await client.scan(cursor);
            cursor = scanResult[0];
            keys.push(...scanResult[1]);
        } while (cursor !== '0');

        const keysToDelete = keys.filter((key) =>
            prefixes.some((prefix) => key.startsWith(prefix)),
        );

        await Promise.all(keysToDelete.map((key) => client.del(key)));
        return keysToDelete;
    } catch (error) {
        console.warn('Error busting Redis cache by prefixes:', error);
        return [];
    }
}
