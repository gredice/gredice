import { useThree } from '@react-three/fiber';
import {
    createContext,
    memo,
    type ReactNode,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import type { InstancedMesh } from 'three';
import { createMeshInstanceMatrix } from '../../entities/chunkedMeshGeometry';
import {
    recordPlacementAnimationChunkRebuild,
    shouldRecordPlacementAnimationChunkRebuild,
} from '../../entities/placementAnimationProfileMetrics';
import { useGardenPaletteFallbackResources } from '../gardenPaletteFallbackResources';
import {
    StaticOpaqueSceneCacheBoundary,
    type StaticOpaqueSceneCacheGroup,
} from '../StaticOpaqueSceneCache';
import {
    recordStaticRenderPacketCompile,
    recordStaticRenderPacketFallbackComponent,
    recordStaticRenderPacketFallbackMesh,
    type StaticRenderPacket,
    type StaticRenderPacketContribution,
    type StaticRenderPacketFallbackReason,
    StaticRenderPacketRegistry,
} from './staticRenderPackets';
import {
    createStaticRenderPacketVisibilityMeshes,
    guardStaticRenderPacketDrawRanges,
    StaticRenderPacketDrawRanges,
} from './staticRenderPacketVisibility';
import { useCompiledChunkSources } from './useCompiledChunk';

const StaticRenderPacketContext =
    createContext<StaticRenderPacketRegistry | null>(null);

export function useStaticRenderPacketRegistry() {
    return useContext(StaticRenderPacketContext);
}

/**
 * Batches the stable merged chunks of every participating descendant into
 * shared chunk render packets. Participants must render in this provider's
 * coordinate space, which holds for garden-space entity instances.
 */
export function StaticRenderPacketBatchProvider({
    children,
}: {
    children: ReactNode;
}) {
    const [registry] = useState(() => new StaticRenderPacketRegistry());

    return (
        <StaticRenderPacketContext.Provider value={registry}>
            {children}
            <StaticRenderPackets registry={registry} />
        </StaticRenderPacketContext.Provider>
    );
}

let nextOwnerId = 0;

/** Stable id that prefixes one owner's contribution ids. */
export function useStaticRenderPacketOwnerId() {
    const [ownerId] = useState(() => {
        nextOwnerId += 1;
        return `owner-${nextOwnerId.toString(36).padStart(6, '0')}`;
    });
    return ownerId;
}

/**
 * Registers one owner's contributions while `contributions` is defined and
 * reports why an eligible merged-chunk component stayed on its own path.
 */
export function useStaticRenderPacketContributions(
    ownerId: string,
    contributions: readonly StaticRenderPacketContribution[] | undefined,
    fallbackReason: StaticRenderPacketFallbackReason | undefined,
) {
    const registry = useStaticRenderPacketRegistry();

    useLayoutEffect(() => {
        if (!registry) return;
        if (contributions) registry.set(ownerId, contributions);
        else registry.delete(ownerId);
    }, [contributions, ownerId, registry]);
    useLayoutEffect(() => {
        if (!registry) return;
        return () => registry.delete(ownerId);
    }, [ownerId, registry]);
    useEffect(() => {
        if (!registry || !fallbackReason) return;
        recordStaticRenderPacketFallbackComponent(fallbackReason, 1);
        return () =>
            recordStaticRenderPacketFallbackComponent(fallbackReason, -1);
    }, [fallbackReason, registry]);
}

function useRetainedGroups(packets: readonly StaticRenderPacket[]) {
    const previous = useRef(
        new Map<
            StaticOpaqueSceneCacheGroup | undefined,
            StaticRenderPacket[]
        >(),
    );
    return useMemo(() => {
        const next = new Map<
            StaticOpaqueSceneCacheGroup | undefined,
            StaticRenderPacket[]
        >();
        for (const packet of packets) {
            const group = next.get(packet.cacheGroup);
            if (group) group.push(packet);
            else next.set(packet.cacheGroup, [packet]);
        }
        for (const [key, group] of next) {
            const old = previous.current.get(key);
            if (
                old &&
                old.length === group.length &&
                old.every((packet, index) => packet === group[index])
            )
                next.set(key, old);
        }
        previous.current = next;
        return next;
    }, [packets]);
}

function StaticRenderPackets({
    registry,
}: {
    registry: StaticRenderPacketRegistry;
}) {
    const packets = useSyncExternalStore(
        registry.subscribe,
        registry.getSnapshot,
        registry.getSnapshot,
    );
    const groups = useRetainedGroups(packets);
    const gl = useThree((state) => state.gl);
    const [drawRanges] = useState(() => new StaticRenderPacketDrawRanges());
    useLayoutEffect(
        () => guardStaticRenderPacketDrawRanges(gl, drawRanges),
        [drawRanges, gl],
    );

    return [...groups].map(([group, groupPackets]) => (
        <StaticRenderPacketGroup
            key={group ?? 'live'}
            group={group}
            packets={groupPackets}
            drawRanges={drawRanges}
        />
    ));
}

const StaticRenderPacketGroup = memo(function StaticRenderPacketGroup({
    group,
    packets,
    drawRanges,
}: {
    group: StaticOpaqueSceneCacheGroup | undefined;
    packets: StaticRenderPacket[];
    drawRanges: StaticRenderPacketDrawRanges;
}) {
    const counts = useMemo(
        () =>
            packets.reduce(
                (total, packet) => ({
                    instanceCount: total.instanceCount + packet.instanceCount,
                    triangleCount: total.triangleCount + packet.triangleCount,
                }),
                { instanceCount: 0, triangleCount: 0 },
            ),
        [packets],
    );

    return (
        <StaticOpaqueSceneCacheBoundary
            contentKey={packets}
            group={group}
            instanceCount={counts.instanceCount}
            submissionCount={packets.length}
            triangleCount={counts.triangleCount}
        >
            {packets.map((packet) => (
                <StaticRenderPacketMesh
                    key={packet.key}
                    packet={packet}
                    drawRanges={drawRanges}
                />
            ))}
        </StaticOpaqueSceneCacheBoundary>
    );
});

const StaticRenderPacketMesh = memo(function StaticRenderPacketMesh({
    packet,
    drawRanges,
}: {
    packet: StaticRenderPacket;
    drawRanges: StaticRenderPacketDrawRanges;
}) {
    const build = useCompiledChunkSources(packet.sources);
    const previousBuild = useRef<StaticRenderPacket | undefined>(undefined);
    useEffect(() => {
        if (!build) return;
        recordStaticRenderPacketCompile(build.durationMs);
        const previous = previousBuild.current;
        if (
            previous &&
            (packet.placementContributions ?? packet.contributions).some(
                (contribution) => {
                    const old = (
                        previous.placementContributions ??
                        previous.contributions
                    ).find(({ id }) => id === contribution.id);
                    return shouldRecordPlacementAnimationChunkRebuild({
                        currentInstances: contribution.instances,
                        currentPlacementSignature:
                            contribution.placementSignature ?? '',
                        previousInstances: old?.instances,
                        previousPlacementSignature:
                            old?.placementSignature ?? '',
                    });
                },
            )
        )
            recordPlacementAnimationChunkRebuild({
                durationMs: build.durationMs,
                transformedInstanceCount: packet.instanceCount,
            });
        previousBuild.current = packet;
    }, [build, packet]);
    const debugName = `StaticRenderPacket:${packet.chunkKey}:${packet.material.name || packet.material.type}:sources:${packet.contributions.length}:count:${packet.instanceCount}`;
    const palette = packet.contributions.some(({ geometry }) =>
        geometry.hasAttribute('aGardenPalette0'),
    );
    const meshes = useMemo(
        () =>
            palette && build?.geometry.getAttribute('position')
                ? createStaticRenderPacketVisibilityMeshes(
                      packet,
                      build.geometry,
                      drawRanges,
                      debugName,
                  )
                : [],
        [build, debugName, drawRanges, packet, palette],
    );

    if (!build) {
        // Pending or failed compiles keep the exact instanced presentation.
        return packet.contributions.map((contribution) => (
            <StaticRenderPacketInstancedFallback
                key={contribution.id}
                contribution={contribution}
                debugName={`${debugName}:fallback:${contribution.id}`}
            />
        ));
    }
    if (!build.geometry.getAttribute('position')) return null;
    if (!palette)
        return (
            <mesh
                name={debugName}
                castShadow={packet.castShadow}
                receiveShadow={packet.receiveShadow}
                renderOrder={packet.renderOrder}
                geometry={build.geometry}
                material={packet.material}
            />
        );

    return meshes.map((mesh) => <primitive key={mesh.uuid} object={mesh} />);
});

const StaticRenderPacketInstancedFallback = memo(
    function StaticRenderPacketInstancedFallback({
        contribution,
        debugName,
    }: {
        contribution: StaticRenderPacketContribution;
        debugName: string;
    }) {
        const meshRef = useRef<InstancedMesh | null>(null);
        const { instances, localTransform, scale } = contribution;
        // Eligible clones release fallback-only GPU buffers and programs when
        // ready. Borrowed originals never reach a pending frame.
        const sourceGeometry =
            contribution.fallbackGeometry ?? contribution.geometry;
        const sourceMaterial =
            contribution.fallbackMaterial ?? contribution.material;
        const resources = useGardenPaletteFallbackResources(
            sourceGeometry,
            sourceMaterial,
            sourceMaterial !== contribution.material &&
                contribution.geometry.hasAttribute('aGardenPalette0'),
        );
        const geometry = resources?.geometry;
        const material = resources?.material;

        useLayoutEffect(() => {
            recordStaticRenderPacketFallbackMesh(1);
            return () => recordStaticRenderPacketFallbackMesh(-1);
        }, []);
        useLayoutEffect(() => {
            const mesh = meshRef.current;
            if (
                !mesh ||
                mesh.geometry !== geometry ||
                mesh.material !== material
            )
                return;
            instances.forEach((instance, index) => {
                mesh.setMatrixAt(
                    index,
                    createMeshInstanceMatrix(instance, localTransform, scale),
                );
            });
            mesh.count = instances.length;
            mesh.instanceMatrix.needsUpdate = true;
            mesh.computeBoundingBox();
            mesh.computeBoundingSphere();
        }, [geometry, instances, localTransform, material, scale]);

        if (!geometry || !material) return null;

        return (
            <instancedMesh
                ref={meshRef}
                name={debugName}
                args={[geometry, material, instances.length]}
                castShadow={contribution.castShadow}
                receiveShadow={contribution.receiveShadow}
                renderOrder={contribution.renderOrder}
            />
        );
    },
);
