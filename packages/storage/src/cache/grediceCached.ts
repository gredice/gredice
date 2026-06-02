import { bustRedisCached, redisCached, redisCachedInfo } from './redisCache';

export const grediceCacheKeys = {
    forecastBjelovar: 'forecastBjelovar',
    weatherAlertsCroatia: 'weatherAlertsCroatia',
    airSensorOpgIb: 'airSensorOpgIb',
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
