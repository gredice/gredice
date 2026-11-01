import { isStaticOpaqueSceneCacheReplayMaterialEligible } from '../staticOpaqueSceneCacheReplay';
import { isStaticOpaqueSceneCacheMaterialEligible } from '../staticOpaqueSceneCacheState';
import type { StaticRenderPacket } from './staticRenderPackets';

/** Unsupported packets keep their layer's other immutable packets replayable. */
export function groupStaticRenderPacketsForCache(
    packets: readonly StaticRenderPacket[],
    previous = new Map<string, StaticRenderPacket[]>(),
) {
    const next = new Map<string, StaticRenderPacket[]>();
    for (const packet of packets) {
        const replayable =
            isStaticOpaqueSceneCacheMaterialEligible(packet.material) &&
            isStaticOpaqueSceneCacheReplayMaterialEligible(packet.material);
        const key = packet.cacheGroup
            ? `${packet.cacheGroup}:${replayable ? 'replay' : 'live'}`
            : 'live';
        const group = next.get(key);
        if (group) group.push(packet);
        else next.set(key, [packet]);
    }
    for (const [key, group] of next) {
        const old = previous.get(key);
        if (
            old?.length === group.length &&
            old.every((packet, index) => packet === group[index])
        )
            next.set(key, old);
    }
    return next;
}
