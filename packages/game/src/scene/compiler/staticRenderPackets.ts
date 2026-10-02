import type { BufferGeometry, Material } from 'three';
import type {
    ChunkedMeshInstance,
    MeshInstanceLocalTransform,
    MeshInstanceScale,
} from '../../entities/chunkedMeshGeometry';
import { updateGameProfileMetadata } from '../gameProfileMetadata';
import type { GardenMaterialFamily } from '../gardenMaterials';
import type { StaticOpaqueSceneCacheGroup } from '../StaticOpaqueSceneCache';
import type { CompiledChunkSource } from './useCompiledChunk';

/** One component's stable instances of one geometry in one spatial chunk. */
export type StaticRenderPacketContribution = {
    cacheGroup: StaticOpaqueSceneCacheGroup | undefined;
    castShadow: boolean;
    chunkKey: string;
    family: Exclude<GardenMaterialFamily, 'transparent'>;
    geometry: BufferGeometry;
    /** Authored stable inputs for pending compiles; never owned or disposed by the packet. */
    fallbackGeometry?: BufferGeometry;
    fallbackMaterial?: Material;
    /** Stable, unique per registered owner and chunk; orders packet sources. */
    id: string;
    instances: ChunkedMeshInstance[];
    layoutSignature: string;
    localTransform: MeshInstanceLocalTransform;
    material: Material;
    /** Placement membership for physical rebuild telemetry; empty outside a drop. */
    placementSignature?: string;
    receiveShadow: boolean;
    renderOrder: number | undefined;
    scale: MeshInstanceScale;
    triangleCount: number;
};

/** Compatible contributions submitted as one draw. */
export type StaticRenderPacket = {
    cacheGroup: StaticOpaqueSceneCacheGroup | undefined;
    castShadow: boolean;
    chunkKey: string;
    contributions: readonly StaticRenderPacketContribution[];
    family: Exclude<GardenMaterialFamily, 'transparent'>;
    instanceCount: number;
    key: string;
    material: Material;
    receiveShadow: boolean;
    /** Includes zero-instance placement members as telemetry; sources remain nonempty. */
    placementContributions?: readonly StaticRenderPacketContribution[];
    renderOrder: number | undefined;
    sources: readonly CompiledChunkSource[];
    triangleCount: number;
};

/**
 * Contributions batch only when every input that affects rendering other than
 * baked transforms is identical: material instance, shadow flags, render
 * order, cache group, chunk, and vertex layout.
 */
export function staticRenderPacketKey(
    contribution: StaticRenderPacketContribution,
) {
    return [
        contribution.cacheGroup ?? 'live',
        contribution.chunkKey,
        contribution.material.uuid,
        contribution.castShadow ? 'cast' : 'no-cast',
        contribution.receiveShadow ? 'receive' : 'no-receive',
        contribution.renderOrder ?? 0,
        contribution.layoutSignature,
    ].join('|');
}

function sameContributions(
    left: readonly StaticRenderPacketContribution[],
    right: readonly StaticRenderPacketContribution[],
) {
    return (
        left.length === right.length &&
        left.every((contribution, index) => contribution === right[index])
    );
}

function compareIds(
    left: StaticRenderPacketContribution,
    right: StaticRenderPacketContribution,
) {
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

/**
 * Groups contributions into packets. A packet whose contribution list is
 * unchanged keeps its object and `sources` identity, so untouched chunks do
 * not recompile; an unchanged plan returns `previous` itself.
 */
export function planStaticRenderPackets(
    contributions: Iterable<StaticRenderPacketContribution>,
    previous: readonly StaticRenderPacket[] = [],
): readonly StaticRenderPacket[] {
    const grouped = new Map<string, StaticRenderPacketContribution[]>();
    for (const contribution of contributions) {
        if (
            contribution.instances.length === 0 &&
            !contribution.placementSignature
        )
            continue;
        const key = staticRenderPacketKey(contribution);
        const group = grouped.get(key);
        if (group) group.push(contribution);
        else grouped.set(key, [contribution]);
    }
    const previousByKey = new Map(
        previous.map((packet) => [packet.key, packet]),
    );
    const packets = [...grouped.entries()]
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .flatMap(([key, placementContributions]): StaticRenderPacket[] => {
            placementContributions.sort(compareIds);
            const group = placementContributions.filter(
                ({ instances }) => instances.length > 0,
            );
            if (group.length === 0) return [];
            const old = previousByKey.get(key);
            if (
                old &&
                sameContributions(
                    old.placementContributions ?? old.contributions,
                    placementContributions,
                )
            )
                return [old];
            const [first] = group;
            if (!first) throw new Error('Empty static render packet group.');
            return [
                {
                    cacheGroup: first.cacheGroup,
                    castShadow: first.castShadow,
                    chunkKey: first.chunkKey,
                    contributions: group,
                    family: first.family,
                    instanceCount: group.reduce(
                        (total, contribution) =>
                            total + contribution.instances.length,
                        0,
                    ),
                    key,
                    material: first.material,
                    placementContributions,
                    receiveShadow: first.receiveShadow,
                    renderOrder: first.renderOrder,
                    sources: group.map(
                        ({ geometry, instances, localTransform, scale }) => ({
                            geometry,
                            instances,
                            localTransform,
                            scale,
                        }),
                    ),
                    triangleCount: group.reduce(
                        (total, contribution) =>
                            total +
                            contribution.triangleCount *
                                contribution.instances.length,
                        0,
                    ),
                },
            ];
        });
    return packets.length === previous.length &&
        packets.every((packet, index) => packet === previous[index])
        ? previous
        : packets;
}

export type StaticRenderPacketFallbackReason =
    | 'material-array'
    | 'material-node'
    | 'missing-material'
    | 'transparent'
    | 'unsupported-layout'
    | 'weather-integrated';

const metrics = {
    contributions: 0,
    cutoutPackets: 0,
    fallbackComponents: {
        'material-array': 0,
        'material-node': 0,
        'missing-material': 0,
        transparent: 0,
        'unsupported-layout': 0,
        'weather-integrated': 0,
    } satisfies Record<StaticRenderPacketFallbackReason, number>,
    opaquePackets: 0,
    packetCompileMaxMs: 0,
    packetCompiles: 0,
    packetFallbackMeshes: 0,
    packetMaterials: 0,
    packets: 0,
    plans: 0,
    savedSubmissions: 0,
};

export type StaticRenderPacketMetrics = typeof metrics;

function publishMetrics() {
    updateGameProfileMetadata({
        renderPackets: {
            ...metrics,
            fallbackComponents: { ...metrics.fallbackComponents },
        },
    });
}

export function readStaticRenderPacketMetrics(): StaticRenderPacketMetrics {
    return {
        ...metrics,
        fallbackComponents: { ...metrics.fallbackComponents },
    };
}

export function recordStaticRenderPacketPlan(
    packets: readonly StaticRenderPacket[],
) {
    let contributions = 0;
    let cutoutPackets = 0;
    const materials = new Set<Material>();
    for (const packet of packets) {
        contributions += packet.contributions.length;
        if (packet.family === 'cutout') cutoutPackets++;
        materials.add(packet.material);
    }
    metrics.plans++;
    metrics.packets = packets.length;
    metrics.contributions = contributions;
    metrics.savedSubmissions = contributions - packets.length;
    metrics.cutoutPackets = cutoutPackets;
    metrics.opaquePackets = packets.length - cutoutPackets;
    metrics.packetMaterials = materials.size;
    publishMetrics();
}

export function recordStaticRenderPacketCompile(durationMs: number) {
    metrics.packetCompiles++;
    metrics.packetCompileMaxMs = Math.max(
        metrics.packetCompileMaxMs,
        durationMs,
    );
    publishMetrics();
}

export function recordStaticRenderPacketFallbackMesh(delta: 1 | -1) {
    metrics.packetFallbackMeshes += delta;
    publishMetrics();
}

export function recordStaticRenderPacketFallbackComponent(
    reason: StaticRenderPacketFallbackReason,
    delta: 1 | -1,
) {
    metrics.fallbackComponents[reason] += delta;
    publishMetrics();
}

/**
 * Collects contributions from every participating component under one
 * provider and plans packets lazily, once per change, for all of them.
 */
export class StaticRenderPacketRegistry {
    private readonly owners = new Map<
        string,
        readonly StaticRenderPacketContribution[]
    >();
    private readonly listeners = new Set<() => void>();
    private packets: readonly StaticRenderPacket[] = [];
    private dirty = false;

    set(
        owner: string,
        contributions: readonly StaticRenderPacketContribution[],
    ) {
        const previous = this.owners.get(owner);
        if (previous && sameContributions(previous, contributions)) return;
        if (contributions.length === 0) {
            if (!previous) return;
            this.owners.delete(owner);
        } else this.owners.set(owner, contributions);
        this.invalidate();
    }

    delete(owner: string) {
        if (this.owners.delete(owner)) this.invalidate();
    }

    getSnapshot = () => {
        if (this.dirty) {
            this.dirty = false;
            const next = planStaticRenderPackets(
                [...this.owners.values()].flat(),
                this.packets,
            );
            if (next !== this.packets) {
                this.packets = next;
                recordStaticRenderPacketPlan(next);
            }
        }
        return this.packets;
    };

    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    private invalidate() {
        this.dirty = true;
        for (const listener of this.listeners) listener();
    }
}
