import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
    BoxGeometry,
    type BufferGeometry,
    DoubleSide,
    InstancedMesh,
    Mesh,
    MeshStandardMaterial,
    Raycaster,
    Vector3,
} from 'three';
import {
    type EntityBlockInstance,
    EntityInstancesGeometry,
} from '../src/entities/EntityInstancesBlock';
import { readPlacementAnimationProfileMetrics } from '../src/entities/placementAnimationProfileMetrics';
import { readChunkCompilerMetrics } from '../src/scene/compiler/chunkCompilerMetrics';
import {
    StaticRenderPacketBatchProvider,
    useStaticRenderPacketContributions,
    useStaticRenderPacketRegistry,
} from '../src/scene/compiler/StaticRenderPacketBatch';
import { readStaticRenderPacketMetrics } from '../src/scene/compiler/staticRenderPackets';
import { readSharedGardenMaterialMetrics } from '../src/scene/gardenMaterials';
import { countGeometryTriangles } from '../src/scene/weatherSurfaceGeometry';
import { GardenPacketNativeProgramWitness } from './gardenPacketNativeProgramWitness';

export type GardenPaletteAdmissionPlacementTelemetry =
    | 'none'
    | 'insert'
    | 'replace'
    | 'drawable';

function PlacementTelemetryMember({
    mode,
}: {
    mode: GardenPaletteAdmissionPlacementTelemetry;
}) {
    const registry = useStaticRenderPacketRegistry();
    if (!registry) throw new Error('Fixture packet registry is required');
    const packets = useSyncExternalStore(
        registry.subscribe,
        registry.getSnapshot,
        registry.getSnapshot,
    );
    const source = packets[0]?.contributions.find(
        ({ id }) => id !== 'fixture-placement-telemetry',
    );
    const contributions = useMemo(
        () =>
            mode === 'none' || !source
                ? undefined
                : [
                      {
                          ...source,
                          id: 'fixture-placement-telemetry',
                          instances:
                              mode === 'drawable'
                                  ? source.instances.slice(0, 1)
                                  : [],
                          placementSignature: `["${mode}"]`,
                      },
                  ],
        [mode, source],
    );
    useStaticRenderPacketContributions(
        'fixture-placement-owner',
        contributions,
        undefined,
    );
    return null;
}

function fixtureInstances(name: string, offset: number): EntityBlockInstance[] {
    return [-6, 2].map((x) => {
        const block = { id: `${name}:${x}`, name, rotation: 0 };
        return {
            block,
            blockIndex: 0,
            id: block.id,
            pickupOutlineVisible: false,
            position: [x + offset, 0.5, 0],
            rotation: 0,
            stack: { position: new Vector3(x + offset, 0, 0), blocks: [block] },
            stackHeight: 0,
        };
    });
}

export function GardenPaletteAdmissionScene({
    batch,
    aggregate,
    sources,
    mutated,
    patched,
    mounted,
    placementTelemetry,
    nativeProgramWitness,
    onReadback,
}: {
    batch: boolean;
    aggregate: boolean;
    sources: 1 | 3;
    mutated: boolean;
    patched: boolean;
    mounted: boolean;
    placementTelemetry: GardenPaletteAdmissionPlacementTelemetry;
    nativeProgramWitness: boolean;
    onReadback: (value: { key: string; [key: string]: unknown }) => void;
}) {
    const { scene, gl, camera } = useThree();
    const programWitness = useRef(new GardenPacketNativeProgramWitness());
    const nativeDraws = useRef({ pending: 0, stock: 0 });
    useLayoutEffect(() => {
        const stopProgramWitness = nativeProgramWitness
            ? programWitness.current.install(gl, camera)
            : () => {};
        const original = gl.renderBufferDirect;
        const observed: typeof original = (...args) => {
            const [drawCamera, , , material, object] = args;
            const calls = gl.info.render.calls;
            original.apply(gl, args);
            if (drawCamera !== camera || gl.info.render.calls <= calls) return;
            if (
                object.name.startsWith('StaticRenderPacket:') &&
                object.name.includes(':fallback:') &&
                material.name.endsWith(':StaticPacketFallback')
            )
                nativeDraws.current.pending++;
            if (
                object.name.startsWith('StaticRenderPacket:') &&
                material.name.endsWith(':GardenStock')
            )
                nativeDraws.current.stock++;
        };
        gl.renderBufferDirect = observed;
        return () => {
            if (gl.renderBufferDirect === observed)
                gl.renderBufferDirect = original;
            stopProgramWitness();
        };
    }, [camera, gl, nativeProgramWitness]);
    const resources = useMemo(() => {
        const geometry = new BoxGeometry(1, 1, 1);
        // Force the real worker path so initial pending fallback reaches a frame.
        const workerGeometry = new BoxGeometry(1, 1, 1, 16, 16, 16);
        const material = new MeshStandardMaterial({
            color: '#3273bc',
            roughness: 0.25,
            metalness: 0.4,
            side: DoubleSide,
        });
        const unknown = new MeshStandardMaterial({
            color: '#a74459',
            roughness: 0.6,
        });
        unknown.onBeforeCompile = (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <color_fragment>',
                '#include <color_fragment>\ndiffuseColor.rgb *= vec3(0.4, 1.0, 0.8);',
            );
        };
        return {
            geometry,
            workerGeometry,
            material,
            unknown,
            wood: fixtureInstances('admission:wood', 0),
            roof: fixtureInstances('admission:roof', 2),
            metal: fixtureInstances('admission:metal', 4),
            unknownInstances: fixtureInstances('admission:unknown', 6),
        };
    }, []);
    useLayoutEffect(
        () => () => {
            resources.geometry.dispose();
            resources.workerGeometry.dispose();
            resources.material.dispose();
            resources.unknown.dispose();
        },
        [resources],
    );
    const borrowedSourceDisposals = useRef(0);
    useLayoutEffect(() => {
        const disposed = () => borrowedSourceDisposals.current++;
        resources.geometry.addEventListener('dispose', disposed);
        resources.workerGeometry.addEventListener('dispose', disposed);
        return () => {
            resources.geometry.removeEventListener('dispose', disposed);
            resources.workerGeometry.removeEventListener('dispose', disposed);
        };
    }, [resources]);
    const roof = useMemo(
        () => (patched ? resources.roof.slice(1) : resources.roof),
        [patched, resources.roof],
    );
    const key = `${batch}:${mutated}:${patched}:${mounted}${aggregate ? `:aggregate:${sources}` : ''}${placementTelemetry === 'none' ? '' : `:placement:${placementTelemetry}`}`;
    const frames = useRef({
        key: '',
        count: 0,
        reported: false,
        fallbackFrames: 0,
        paletteFallbacks: 0,
        borrowedFallbacks: 0,
        borrowedFallbackGeometries: 0,
    });
    const fallbackMaterials = useRef({
        seen: new Set<MeshStandardMaterial>(),
        disposed: new Set<MeshStandardMaterial>(),
    });
    const fallbackGeometries = useRef({
        seen: new Set<BufferGeometry>(),
        disposed: new Set<BufferGeometry>(),
    });
    useFrame(() => {
        programWitness.current.setEpoch(key);
        if (frames.current.key !== key)
            frames.current = {
                key,
                count: 0,
                reported: false,
                fallbackFrames: 0,
                paletteFallbacks: 0,
                borrowedFallbacks: 0,
                borrowedFallbackGeometries: 0,
            };
        frames.current.count++;
        const pendingFallbacks: Mesh[] = [];
        scene.traverse((object) => {
            if (
                object instanceof Mesh &&
                object.name.startsWith('StaticRenderPacket:') &&
                object.name.includes(':fallback:')
            )
                pendingFallbacks.push(object);
        });
        if (pendingFallbacks.length > 0) frames.current.fallbackFrames++;
        frames.current.paletteFallbacks += pendingFallbacks.filter(
            (mesh) =>
                mesh.geometry.hasAttribute('aGardenPalette0') ||
                (Array.isArray(mesh.material)
                    ? mesh.material
                    : [mesh.material]
                ).some((material) => material.name.endsWith(':GardenPalette')),
        ).length;
        for (const mesh of pendingFallbacks) {
            const fallbackGeometry = mesh.geometry;
            if (
                fallbackGeometry === resources.geometry ||
                fallbackGeometry === resources.workerGeometry
            )
                frames.current.borrowedFallbackGeometries++;
            if (!fallbackGeometries.current.seen.has(fallbackGeometry)) {
                fallbackGeometries.current.seen.add(fallbackGeometry);
                fallbackGeometry.addEventListener('dispose', () =>
                    fallbackGeometries.current.disposed.add(fallbackGeometry),
                );
            }
            const materials = Array.isArray(mesh.material)
                ? mesh.material
                : [mesh.material];
            for (const material of materials) {
                if (
                    !(material instanceof MeshStandardMaterial) ||
                    !material.name.endsWith(':StaticPacketFallback')
                ) {
                    frames.current.borrowedFallbacks++;
                    continue;
                }
                if (fallbackMaterials.current.seen.has(material)) continue;
                fallbackMaterials.current.seen.add(material);
                material.addEventListener('dispose', () =>
                    fallbackMaterials.current.disposed.add(material),
                );
            }
        }
        if (frames.current.reported || frames.current.count < 12) return;
        const compiler = readChunkCompilerMetrics();
        const packets = readStaticRenderPacketMetrics();
        if (
            compiler.pendingJobs > 0 ||
            packets.packetFallbackMeshes > 0 ||
            (batch &&
                mounted &&
                packets.contributions !==
                    (sources === 1 ? 2 : patched ? 5 : 6) +
                        (placementTelemetry === 'drawable' ? 1 : 0))
        )
            return;
        const meshes: Mesh[] = [];
        const raycastMeshes: Mesh[] = [];
        scene.traverse((object) => {
            if (
                object instanceof Mesh &&
                (object.name.startsWith('BlockInstances:admission:') ||
                    object.name.startsWith('StaticRenderPacket:'))
            ) {
                raycastMeshes.push(object);
                if (!object.name.includes(':visible-range:'))
                    meshes.push(object);
            }
        });
        const geometryIds = Object.fromEntries(
            meshes
                .filter((mesh) => mesh.name.startsWith('StaticRenderPacket:'))
                .map((mesh) => [
                    `${mesh.name.split(':').slice(1, 3).join(':')}|${Array.isArray(mesh.material) ? 'array' : mesh.material.uuid}`,
                    mesh.geometry.uuid,
                ]),
        );
        const raycaster = new Raycaster(
            new Vector3(2, 5, 0),
            new Vector3(0, -1, 0),
        );
        const hit = raycaster.intersectObjects(raycastMeshes, false)[0];
        frames.current.reported = true;
        onReadback({
            key,
            packets,
            compiler,
            placement: readPlacementAnimationProfileMetrics(),
            fallbackFrames: frames.current.fallbackFrames,
            nativePendingDraws: nativeDraws.current.pending,
            nativeStockDraws: nativeDraws.current.stock,
            paletteFallbacks: frames.current.paletteFallbacks,
            borrowedFallbacks: frames.current.borrowedFallbacks,
            liveFallbackMaterials:
                fallbackMaterials.current.seen.size -
                fallbackMaterials.current.disposed.size,
            disposedFallbackMaterials: fallbackMaterials.current.disposed.size,
            borrowedFallbackGeometries:
                frames.current.borrowedFallbackGeometries,
            liveFallbackGeometries:
                fallbackGeometries.current.seen.size -
                fallbackGeometries.current.disposed.size,
            disposedFallbackGeometries:
                fallbackGeometries.current.disposed.size,
            materials: readSharedGardenMaterialMetrics(),
            meshes: meshes.length,
            triangles: meshes.reduce(
                (total, mesh) =>
                    total +
                    countGeometryTriangles(mesh.geometry) *
                        (mesh instanceof InstancedMesh ? mesh.count : 1),
                0,
            ),
            geometryIds,
            borrowedSourceDisposals: borrowedSourceDisposals.current,
            nativePrograms: programWitness.current.read(),
            singletonMeshes: meshes.filter((mesh) =>
                mesh.name.endsWith(':singleton'),
            ).length,
            borrowedSingletonGeometries: meshes.filter(
                (mesh) =>
                    mesh.name.endsWith(':singleton') &&
                    (mesh.geometry === resources.geometry ||
                        mesh.geometry === resources.workerGeometry),
            ).length,
            hit: hit
                ? { x: hit.point.x, y: hit.point.y, z: hit.point.z }
                : null,
            unknownMeshes: meshes.filter((mesh) =>
                mesh.name.startsWith('BlockInstances:admission:unknown'),
            ).length,
        });
    });
    return (
        <>
            <color attach="background" args={['#18222d']} />
            <ambientLight intensity={0.4} />
            <directionalLight
                position={[3, 8, 4]}
                intensity={3}
                castShadow
                shadow-mapSize={[1024, 1024]}
                shadow-camera-left={-12}
                shadow-camera-right={12}
                shadow-camera-top={12}
                shadow-camera-bottom={-12}
                shadow-normalBias={0.015}
            />
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[24, 12]} />
                <meshStandardMaterial color="#807767" roughness={1} />
            </mesh>
            <StaticRenderPacketBatchProvider>
                <PlacementTelemetryMember mode={placementTelemetry} />
                {mounted && (
                    <>
                        <EntityInstancesGeometry
                            instanceKey="admission:wood"
                            instances={resources.wood}
                            geometry={resources.geometry}
                            batchStaticMaterial={batch}
                            renderSnow={false}
                            materialNode={
                                <meshStandardMaterial
                                    color={aggregate ? '#3273bc' : '#744020'}
                                    roughness={aggregate ? 0.25 : 0.9}
                                    metalness={aggregate ? 0.4 : 0}
                                    side={DoubleSide}
                                />
                            }
                        />
                        {sources === 3 && (
                            <>
                                <EntityInstancesGeometry
                                    instanceKey="admission:roof"
                                    instances={roof}
                                    geometry={resources.geometry}
                                    batchStaticMaterial={batch}
                                    renderSnow={false}
                                    materialNode={
                                        <meshStandardMaterial
                                            color={
                                                mutated
                                                    ? '#4b9965'
                                                    : aggregate
                                                      ? '#3273bc'
                                                      : '#2f3437'
                                            }
                                            roughness={
                                                mutated
                                                    ? 0.3
                                                    : aggregate
                                                      ? 0.25
                                                      : 0.62
                                            }
                                            metalness={aggregate ? 0.4 : 0.3}
                                            side={DoubleSide}
                                        />
                                    }
                                />
                                <EntityInstancesGeometry
                                    instanceKey="admission:metal"
                                    instances={resources.metal}
                                    geometry={resources.workerGeometry}
                                    batchStaticMaterial={batch}
                                    renderSnow={false}
                                    material={resources.material}
                                />
                                <EntityInstancesGeometry
                                    instanceKey="admission:unknown"
                                    instances={resources.unknownInstances}
                                    geometry={resources.geometry}
                                    batchStaticMaterial={batch}
                                    renderSnow={false}
                                    material={resources.unknown}
                                />
                            </>
                        )}
                    </>
                )}
            </StaticRenderPacketBatchProvider>
        </>
    );
}
