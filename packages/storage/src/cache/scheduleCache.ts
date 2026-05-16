import {
    bustRedisCacheByPrefixes,
    type RedisCacheNamespace,
    redisCached,
} from './redisCache';

type DateRangeCacheInput = {
    from?: Date;
    to?: Date;
    completedFrom?: Date;
    completedTo?: Date;
    status?: string | string[];
};

type DeliveryRequestsSummaryCacheInput = {
    accountId?: string;
    state?: string;
    slotId?: number;
    fromDate?: Date;
    toDate?: Date;
};

const CACHE_VERSION = 'v2';

export const scheduleCacheTtls = {
    day: 45,
    operations: 60,
    raisedBeds: 180,
    deliveryRequestsSummary: 45,
} as const;

function safePart(value: string | number | null | undefined) {
    if (value === null || typeof value === 'undefined' || value === '') {
        return 'none';
    }

    return encodeURIComponent(String(value));
}

function dateTimePart(value?: Date) {
    return value ? safePart(value.toISOString()) : 'none';
}

function statusPart(value?: string | string[]) {
    if (!value) {
        return 'none';
    }

    return safePart(Array.isArray(value) ? [...value].sort().join(',') : value);
}

function localDateKey(value: Date | string) {
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) {
        return safePart(String(value));
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function rangePart(input?: DateRangeCacheInput) {
    return [
        `from:${dateTimePart(input?.from)}`,
        `to:${dateTimePart(input?.to)}`,
        `completedFrom:${dateTimePart(input?.completedFrom)}`,
        `completedTo:${dateTimePart(input?.completedTo)}`,
        `status:${statusPart(input?.status)}`,
    ].join(':');
}

export const scheduleCacheKeys = {
    adminRaisedBeds: () => `schedule:admin:raisedBeds:${CACHE_VERSION}`,
    adminOperations: (input?: DateRangeCacheInput) =>
        `schedule:admin:operations:${rangePart(input)}:${CACHE_VERSION}`,
    adminActiveOperations: (from: Date, completedFrom: Date) =>
        `schedule:admin:operations:active:from:${dateTimePart(from)}:completedFrom:${dateTimePart(completedFrom)}:${CACHE_VERSION}`,
    adminDay: (date: Date | string, isToday: boolean) =>
        `schedule:admin:day:${localDateKey(date)}:today:${isToday ? '1' : '0'}:${CACHE_VERSION}`,
    farmUserRaisedBeds: (userId: string) =>
        `schedule:farm:user:${safePart(userId)}:raisedBeds:${CACHE_VERSION}`,
    farmUserOperations: (userId: string, input?: DateRangeCacheInput) =>
        `schedule:farm:user:${safePart(userId)}:operations:${rangePart(input)}:${CACHE_VERSION}`,
    farmUserActiveOperations: (userId: string, from: Date) =>
        `schedule:farm:user:${safePart(userId)}:operations:active:from:${dateTimePart(from)}:${CACHE_VERSION}`,
    farmUserDay: (userId: string, date: Date | string, isToday: boolean) =>
        `schedule:farm:user:${safePart(userId)}:day:${localDateKey(date)}:today:${isToday ? '1' : '0'}:${CACHE_VERSION}`,
    deliveryRequestsSummary: (input: DeliveryRequestsSummaryCacheInput) =>
        [
            'delivery:requests:summary',
            `account:${safePart(input.accountId)}`,
            `state:${safePart(input.state)}`,
            `slot:${safePart(input.slotId)}`,
            `from:${dateTimePart(input.fromDate)}`,
            `to:${dateTimePart(input.toDate)}`,
            CACHE_VERSION,
        ].join(':'),
};

export function cacheScheduleRead<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number = scheduleCacheTtls.operations,
) {
    return redisCached(key, fn, {
        ttl,
        maxPayloadBytes: 2 * 1024 * 1024,
    });
}

export async function bustScheduleCache() {
    await bustRedisCacheByPrefixes(['schedule:', 'dashboard:admin:']);
}

export async function bustDeliveryRequestsCache() {
    await bustRedisCacheByPrefixes([
        'delivery:requests:summary:',
        'schedule:admin:day:',
        'dashboard:admin:',
    ]);
}

export async function bustStorageCacheByPrefixes(
    prefixes: string[],
    namespace: RedisCacheNamespace = 'plants',
) {
    return bustRedisCacheByPrefixes(prefixes, namespace);
}
