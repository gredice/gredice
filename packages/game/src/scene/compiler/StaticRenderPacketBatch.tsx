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
import type { BufferGeometry, InstancedMesh, Material } from 'three';
import { createMeshInstanceMatrix } from '../../entities/chunkedMeshGeometry';
import {
    placementAnimationProfileNow,
    recordPlacementAnimationChunkRebuild,
    shouldRecordPlacementAnimationChunkRebuild,
} from '../../entities/placementAnimationProfileMetrics';
import { useGardenPacketFallbackResources } from '../gardenPacketFallbackResources';
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
    const singleton = packet.contributions[0];
    if (
        packet.contributions.length === 1 &&
        singleton?.sourceBoundsCulling &&
        singleton.originalVisibilityMode === 'instanced'
    )
        return (
            <StaticRenderPacketInstancedMesh
                contribution={singleton}
                recordPlacementChanges
                geometry={singleton.geometry}
                material={singleton.material}
                debugName={`StaticRenderPacket:${packet.chunkKey}:${packet.material.name || packet.material.type}:sources:1:count:${packet.instanceCount}:singleton`}
            />
        );
    // A separate child owns compilation so a singleton never queues a job or
    // allocates a merged buffer. Rejoining a group mounts a fresh compile lease.
    return (
        <StaticRenderPacketCompiledMesh
            packet={packet}
            drawRanges={drawRanges}
        />
    );
});

const StaticRenderPacketCompiledMesh = memo(
    function StaticRenderPacketCompiledMesh({
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
        const sourceBoundsCulling = packet.contributions.every(
            ({ sourceBoundsCulling }) => sourceBoundsCulling,
        );
        const meshes = useMemo(
            () =>
                sourceBoundsCulling && build?.geometry.getAttribute('position')
                    ? createStaticRenderPacketVisibilityMeshes(
                          packet,
                          build.geometry,
                          drawRanges,
                          debugName,
                      )
                    : [],
            [build, debugName, drawRanges, packet, sourceBoundsCulling],
        );
        if (!build)
            return packet.contributions.map((contribution) => (
                <StaticRenderPacketInstancedFallback
                    key={contribution.id}
                    contribution={contribution}
                    debugName={`${debugName}:fallback:${contribution.id}`}
                />
            ));
        if (!build.geometry.getAttribute('position')) return null;
        if (sourceBoundsCulling)
            return meshes.map((mesh) => (
                <primitive key={mesh.uuid} object={mesh} />
            ));
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
    },
);

const StaticRenderPacketInstancedFallback = memo(
    function StaticRenderPacketInstancedFallback({
        contribution,
        debugName,
    }: {
        contribution: StaticRenderPacketContribution;
        debugName: string;
    }) {
        // Eligible clones release fallback-only GPU buffers and programs when
        // ready. Borrowed originals never reach a pending frame.
        const sourceGeometry =
            contribution.fallbackGeometry ?? contribution.geometry;
        const sourceMaterial =
            contribution.fallbackMaterial ?? contribution.material;
        const resources = useGardenPacketFallbackResources(
            sourceGeometry,
            sourceMaterial,
            sourceMaterial !== contribution.material &&
                Boolean(contribution.sourceBoundsCulling),
        );
        const geometry = resources?.geometry;
        const material = resources?.material;

        useLayoutEffect(() => {
            recordStaticRenderPacketFallbackMesh(1);
            return () => recordStaticRenderPacketFallbackMesh(-1);
        }, []);
        if (!geometry || !material) return null;
        return (
            <StaticRenderPacketInstancedMesh
                contribution={contribution}
                debugName={debugName}
                geometry={geometry}
                material={material}
            />
        );
    },
);

const StaticRenderPacketInstancedMesh = memo(
    function StaticRenderPacketInstancedMesh({
        contribution,
        debugName,
        geometry,
        material,
        recordPlacementChanges = false,
    }: {
        contribution: StaticRenderPacketContribution;
        debugName: string;
        geometry: BufferGeometry;
        material: Material;
        recordPlacementChanges?: boolean;
    }) {
        const previous = useRef<StaticRenderPacketContribution | undefined>(
            undefined,
        );
        const meshRef = useRef<InstancedMesh<BufferGeometry, Material> | null>(
            null,
        );
        const { instances, localTransform, scale } = contribution;
        useLayoutEffect(() => {
            const startedAt = placementAnimationProfileNow();
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
            const old = previous.current;
            previous.current = contribution;
            if (
                recordPlacementChanges &&
                shouldRecordPlacementAnimationChunkRebuild({
                    currentInstances: instances,
                    currentPlacementSignature:
                        contribution.placementSignature ?? '',
                    previousInstances: old?.instances,
                    previousPlacementSignature: old?.placementSignature ?? '',
                })
            )
                recordPlacementAnimationChunkRebuild({
                    durationMs: placementAnimationProfileNow() - startedAt,
                    transformedInstanceCount: instances.length,
                });
        }, [
            contribution,
            geometry,
            instances,
            localTransform,
            material,
            recordPlacementChanges,
            scale,
        ]);
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
