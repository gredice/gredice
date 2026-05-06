import {
    bustRedisCacheByPrefixes,
    bustRedisCached,
    redisCached,
    redisCachedInfo,
} from './redisCache';

export const cacheKeys = {
    entity: (entityId: number) => `entity:${entityId}`,
    entityTypeName: (entityTypeName: string) =>
        `entities:formatted:${entityTypeName}:state:published:locale:default:v1`,
};

export async function directoriesCached<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number = 60,
) {
    return redisCached(key, fn, { ttl });
}

export async function directoriesCachedInfo() {
    return redisCachedInfo();
}

export async function bustCached(key: string) {
    console.debug(`Bust cache for key: ${key}`);
    await bustRedisCached(key);
}

export async function bustCachedByPrefixes(prefixes: string[]) {
    return bustRedisCacheByPrefixes(prefixes);
}
