import { Redis } from '@upstash/redis';
import {
    decodeRedisCacheValue,
    encodeRedisCacheValue,
} from './redisCacheCodec';

export type RedisCacheNamespace = 'plants' | 'gredice';

type RedisCacheOptions = {
    namespace?: RedisCacheNamespace;
    ttl?: number;
    jitterRatio?: number;
    maxPayloadBytes?: number;
    required?: boolean;
};

const DEFAULT_TTL_SECONDS = 60;
const DEFAULT_JITTER_RATIO = 0.15;
const DEFAULT_MAX_PAYLOAD_BYTES = 512 * 1024;

const redisClients: Partial<Record<RedisCacheNamespace, Redis>> = {};
const disabledNamespaces = new Set<RedisCacheNamespace>();
const inFlightCacheMisses = new Map<string, Promise<unknown>>();
const missingCredentialWarnings = new Set<RedisCacheNamespace>();
const oversizedCacheWarnings = new Set<string>();

export function redisCacheKeyForEnvironment(
    key: string,
    environment = process.env.VERCEL_ENV,
    projectPrefix = process.env.GREDICE_DIRECTORY_CACHE_PREFIX,
) {
    const prefixSegments = [
        projectPrefix?.trim().replace(/:+$/u, ''),
        environment && environment !== 'production' ? environment : undefined,
    ].filter((segment): segment is string => Boolean(segment));

    return [...prefixSegments, key].join(':');
}

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
    const cacheKey = redisCacheKeyForEnvironment(key);
    const inFlightKey = `${namespace}:${cacheKey}`;
    const pending = inFlightCacheMisses.get(inFlightKey);
    if (pending) {
        return pending as Promise<T>;
    }

    const promise = (async () => {
        const client = redisCacheClient(namespace);
        if (!client) {
            if (options.required) {
                throw new Error(
                    `Redis cache credentials are required for the ${namespace} namespace.`,
                );
            }
            if (
                process.env.VERCEL_ENV &&
                !missingCredentialWarnings.has(namespace)
            ) {
                missingCredentialWarnings.add(namespace);
                console.warn('Redis cache credentials are not configured', {
                    namespace,
                    environment: process.env.VERCEL_ENV,
                });
            }
            return fn();
        }

        try {
            const cachedValue = await client.get<unknown>(cacheKey);
            if (cachedValue !== null) {
                try {
                    const decoded = decodeRedisCacheValue(cachedValue);
                    if (decoded.hit) {
                        return decoded.value as T;
                    }
                } catch (error) {
                    console.warn('Failed to decode Redis cache value', {
                        key: cacheKey,
                        error,
                    });
                }
                await client.del(cacheKey);
            }
        } catch (error) {
            if (options.required) {
                throw new Error(
                    `Required Redis cache read failed for key "${cacheKey}".`,
                    { cause: error },
                );
            }
            console.warn(
                `Error reading Redis cache for key "${cacheKey}":`,
                error,
            );
        }

        const value = await fn();
        if (typeof value === 'undefined') {
            return value;
        }

        try {
            const maxPayloadBytes =
                options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES;
            const encoded = encodeRedisCacheValue(value, {
                maxStoredBytes: maxPayloadBytes,
            });

            if (encoded.cacheValue) {
                await client.set(cacheKey, encoded.cacheValue, {
                    ex: ttlWithJitter(
                        options.ttl ?? DEFAULT_TTL_SECONDS,
                        options.jitterRatio ?? DEFAULT_JITTER_RATIO,
                    ),
                });
            } else if (!oversizedCacheWarnings.has(inFlightKey)) {
                oversizedCacheWarnings.add(inFlightKey);
                console.warn('Redis cache value exceeds the storage limit', {
                    key: cacheKey,
                    sourceBytes: encoded.sourceBytes,
                    storedBytes: encoded.storedBytes,
                    maxPayloadBytes,
                });
            }

            if (!encoded.cacheValue && options.required) {
                throw new Error(
                    `Required Redis cache value exceeds the storage limit for key "${cacheKey}".`,
                );
            }
        } catch (error) {
            if (options.required) {
                throw new Error(
                    `Required Redis cache write failed for key "${cacheKey}".`,
                    { cause: error },
                );
            }
            console.warn(
                `Error setting Redis cache for key "${cacheKey}":`,
                error,
            );
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

        await client.del(redisCacheKeyForEnvironment(key));
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

        const environmentPrefixes = prefixes.map((prefix) =>
            redisCacheKeyForEnvironment(prefix),
        );
        const keysToDelete = keys.filter((key) =>
            environmentPrefixes.some((prefix) => key.startsWith(prefix)),
        );

        await Promise.all(keysToDelete.map((key) => client.del(key)));
        return keysToDelete;
    } catch (error) {
        console.warn('Error busting Redis cache by prefixes:', error);
        return [];
    }
}
