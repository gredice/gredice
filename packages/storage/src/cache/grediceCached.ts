import { bustRedisCached, redisCached, redisCachedInfo } from './redisCache';

export const grediceCacheKeys = {
    forecastBjelovar: 'forecastBjelovar',
    weatherAlertsCroatia: 'weatherAlertsCroatia',
    airSensorOpgIb: 'airSensorOpgIb',
    publicGardenSitemapSources: 'publicGardenSitemapSources:v1',
    featuredPublicGardenIds: 'publicGardens:featuredIds:v1',
    publicGardenActivePlantCounts: 'publicGardens:activePlantCounts:v1',
    publicPlantStatistics: 'publicPlantStatistics:v1',
};

export async function grediceCached<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number = 60,
) {
    return redisCached(key, fn, { ttl, namespace: 'gredice' });
}

export async function grediceCachedInfo() {
    return redisCachedInfo('gredice');
}

export async function bustGrediceCached(key: string) {
    await bustRedisCached(key, 'gredice');
}

export async function bustFeaturedPublicGardenCache() {
    await Promise.all([
        bustGrediceCached(grediceCacheKeys.featuredPublicGardenIds),
        bustGrediceCached(grediceCacheKeys.publicGardenActivePlantCounts),
    ]);
}
