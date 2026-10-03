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
    recordPlacementAnimationChunkRebuild,
    shouldRecordPlacementAnimationChunkRebuild,
} from '../../entities/placementAnimationProfileMetrics';
import { useGardenPaletteFallbackResources } from '../gardenPaletteFallbackResources';
import { useSceneRenderRequest } from '../SceneTime';
import {
    StaticOpaqueSceneCacheBoundary,
    type StaticOpaqueSceneCacheGroup,
} from '../StaticOpaqueSceneCache';
import {
    compileStaticPacketShaders,
    type StaticPacketShaderObject,
    StaticRenderPacketShaderWarmup,
    staticPacketPresentationPreparation,
} from './staticRenderPacketShaderWarmup';
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
const StaticRenderPacketWarmupContext = createContext<
    StaticRenderPacketShaderWarmup | undefined
>(undefined);

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
    const gl = useThree((state) => state.gl);
    const requestRender = useSceneRenderRequest();
    const [warmup, setWarmup] = useState<StaticRenderPacketShaderWarmup>();
    useLayoutEffect(() => {
        const owner = new StaticRenderPacketShaderWarmup(
            compileStaticPacketShaders,
            gl,
            () => requestRender('static-packet-shader-warmup'),
        );
        setWarmup(owner);
        const invalidate = () => owner.invalidate();
        gl.domElement.addEventListener('webglcontextlost', invalidate);
        gl.domElement.addEventListener('webglcontextrestored', invalidate);
        return () => {
            gl.domElement.removeEventListener('webglcontextlost', invalidate);
            gl.domElement.removeEventListener(
                'webglcontextrestored',
                invalidate,
            );
            owner.dispose();
        };
    }, [gl, requestRender]);

    return (
        <StaticRenderPacketContext.Provider value={registry}>
            <StaticRenderPacketWarmupContext.Provider value={warmup}>
                {children}
                <StaticRenderPackets registry={registry} />
            </StaticRenderPacketWarmupContext.Provider>
        </StaticRenderPacketContext.Provider>
    );
}

function useStaticPacketShaderReady(
    object: StaticPacketShaderObject | undefined,
) {
    const warmup = useContext(StaticRenderPacketWarmupContext);
    const [state, setState] = useState<{
        warmup: StaticRenderPacketShaderWarmup;
        object: StaticPacketShaderObject;
        ready: boolean;
    }>();
    useLayoutEffect(() => {
        if (!object || !warmup) return;
        return warmup.register(object, (ready) =>
            setState({ warmup, object, ready }),
        );
    }, [object, warmup]);
    return Boolean(
        state &&
            state.warmup === warmup &&
            state.object === object &&
            state.ready,
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
    const warmup = useContext(StaticRenderPacketWarmupContext);
    const scene = useThree((state) => state.scene);
    const camera = useThree((state) => state.camera);
    useLayoutEffect(() => {
        if (!warmup) return;
        return drawRanges.registerPreparation(
            staticPacketPresentationPreparation(
                gl,
                scene,
                camera,
                (rootScene, rootCamera) =>
                    warmup.prepare(rootScene, rootCamera),
            ),
        );
    }, [camera, drawRanges, gl, scene, warmup]);
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
                      false,
                  )
                : [],
        [build, debugName, drawRanges, packet, palette],
    );
    const shaderReady = useStaticPacketShaderReady(meshes[0]);
    useLayoutEffect(() => {
        // Raycaster ignores visibility. Keep hidden warm objects outside
        // whole-scene picking until the authored fallback hands off.
        for (const mesh of meshes) mesh.setPresentationEnabled(shaderReady);
    }, [meshes, shaderReady]);
    const fallback = !build || (palette && !shaderReady);
    if (build && !build.geometry.getAttribute('position')) return null;

    if (fallback && !palette) {
        // Pending or failed compiles keep the exact instanced presentation.
        return packet.contributions.map((contribution) => (
            <StaticRenderPacketInstancedFallback
                key={contribution.id}
                contribution={contribution}
                debugName={`${debugName}:fallback:${contribution.id}`}
            />
        ));
    }
    if (palette)
        return (
            <>
                {fallback &&
                    packet.contributions.map((contribution) => (
                        <StaticRenderPacketInstancedFallback
                            key={contribution.id}
                            contribution={contribution}
                            debugName={`${debugName}:fallback:${contribution.id}`}
                        />
                    ))}
                {meshes.map((mesh) => (
                    <primitive
                        key={mesh.uuid}
                        object={mesh}
                        visible={Boolean(shaderReady)}
                    />
                ))}
            </>
        );
    if (!build) return null;
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

    return null;
});

const StaticRenderPacketInstancedFallback = memo(
    function StaticRenderPacketInstancedFallback({
        contribution,
        debugName,
    }: {
        contribution: StaticRenderPacketContribution;
        debugName: string;
    }) {
        const meshRef = useRef<InstancedMesh<BufferGeometry, Material> | null>(
            null,
        );
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
        const warmup = useContext(StaticRenderPacketWarmupContext);

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
        useLayoutEffect(() => {
            const mesh = meshRef.current;
            if (
                !mesh ||
                !warmup ||
                geometry === sourceGeometry ||
                material === sourceMaterial
            )
                return;
            // Existing authored presentation stays visible throughout warmup.
            return warmup.register(mesh, () => {});
        }, [geometry, material, sourceGeometry, sourceMaterial, warmup]);

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
