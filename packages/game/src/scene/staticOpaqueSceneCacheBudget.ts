import { staticOpaqueSceneCacheMaximumBytes } from './staticOpaqueSceneCacheState';

const mebibyte = 1024 * 1024;
// Each reported GiB of device memory may hold 20 MiB of cache attachments, so
// 8 GiB devices (Chrome's reported maximum) keep the original 160 MiB ceiling.
const staticOpaqueSceneCacheBytesPerDeviceGiB = 20 * mebibyte;
// Browsers that hide device memory get the budget of a 4 GiB device.
const staticOpaqueSceneCacheUnknownDeviceMemoryGiB = 4;
const staticOpaqueSceneCacheMinimumDeviceMemoryGiB = 2;

export type StaticOpaqueSceneCacheBudgetSource =
    | 'device-memory'
    | 'low-device-memory'
    | 'unknown-device-memory';

export type StaticOpaqueSceneCacheBudget = {
    bytes: number;
    deviceMemoryGiB: number | null;
    source: StaticOpaqueSceneCacheBudgetSource;
};

export function resolveStaticOpaqueSceneCacheBudget({
    deviceMemoryGiB,
    maximumBytes = staticOpaqueSceneCacheMaximumBytes,
}: {
    deviceMemoryGiB?: number | null;
    maximumBytes?: number;
}): StaticOpaqueSceneCacheBudget {
    const knownDeviceMemory =
        typeof deviceMemoryGiB === 'number' &&
        Number.isFinite(deviceMemoryGiB) &&
        deviceMemoryGiB > 0
            ? deviceMemoryGiB
            : null;
    const safeMaximumBytes =
        Number.isFinite(maximumBytes) && maximumBytes > 0
            ? Math.floor(maximumBytes)
            : 0;

    if (
        knownDeviceMemory !== null &&
        knownDeviceMemory < staticOpaqueSceneCacheMinimumDeviceMemoryGiB
    ) {
        return {
            bytes: 0,
            deviceMemoryGiB: knownDeviceMemory,
            source: 'low-device-memory',
        };
    }

    const budgetDeviceMemory =
        knownDeviceMemory ?? staticOpaqueSceneCacheUnknownDeviceMemoryGiB;
    return {
        bytes: Math.min(
            safeMaximumBytes,
            Math.floor(
                budgetDeviceMemory * staticOpaqueSceneCacheBytesPerDeviceGiB,
            ),
        ),
        deviceMemoryGiB: knownDeviceMemory,
        source:
            knownDeviceMemory === null
                ? 'unknown-device-memory'
                : 'device-memory',
    };
}

export function readNavigatorDeviceMemoryGiB() {
    if (typeof navigator === 'undefined') {
        return null;
    }
    const deviceMemory = Reflect.get(navigator, 'deviceMemory');
    return typeof deviceMemory === 'number' ? deviceMemory : null;
}
