import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import {
    BoxGeometry,
    DirectionalLight,
    Mesh,
    MeshStandardMaterial,
    OrthographicCamera,
    Raycaster,
    Vector3,
} from 'three';
import {
    type EntityBlockInstance,
    EntityInstancesGeometry,
} from '../src/entities/EntityInstancesBlock';
import { readChunkCompilerMetrics } from '../src/scene/compiler/chunkCompilerMetrics';
import {
    StaticRenderPacketBatchProvider,
    useStaticRenderPacketRegistry,
} from '../src/scene/compiler/StaticRenderPacketBatch';
import {
    readStaticRenderPacketMetrics,
    type StaticRenderPacketRegistry,
} from '../src/scene/compiler/staticRenderPackets';
import { useSceneAfterFrame } from '../src/scene/useSceneAfterFrame';
import type { GardenPaletteCullingView } from './GardenPaletteCullingFixture';

type Receipt = {
    name: string;
    pass: 'main' | 'shadow';
    start: number;
    count: number;
    triangles: number;
    calls: number;
    geometry: string;
    material: string;
    nativeProgramBefore: number | null;
    nativeReadyBefore: boolean | null;
    nativeProgramAfter: number | null;
    nativeReadyAfter: boolean | null;
};
type RayHit = { distance: number; point: number[]; uv: number[] | null };
type TransitionFrame = {
    phase: 'first-affected' | 'pending' | 'ready';
    revision: number;
    restored: boolean;
    frame: number;
    hiddenPaletteMeshes: number;
    visiblePaletteMeshes: number;
    fallbackMeshes: number;
    receipts: Receipt[];
    sceneRaycastHits: RayHit[][];
    farRejectedHits: number;
    nearRejectedHits: number;
    rangesRestored: boolean;
    png: string;
};
export type GardenPaletteCullingReadback = {
    key: string;
    receipts: Receipt[];
    compiler: ReturnType<typeof readChunkCompilerMetrics>;
    localContributions: {
        id: string;
        sourceBoundsCulling: boolean;
        material: string;
        geometry: string;
    }[];
    packets: ReturnType<typeof readStaticRenderPacketMetrics>;
    geometryIds: string[];
    materialIds: string[];
    rangesRestored: boolean;
    sourceDisposals: number;
    borrowedMaterialIds: string[];
    stockMaterialCount: number;
    frame: number;
    sceneRaycastHits: RayHit[][];
    transitionFrames: TransitionFrame[];
    missingPresentationFrames: number;
    png: string | null;
};

function instances(id: string, x: number): EntityBlockInstance[] {
    const block = { id, name: 'culling', rotation: 0 };
    return [
        {
            block,
            blockIndex: 0,
            id,
            pickupOutlineVisible: false,
            position: [x, 0, 0],
            rotation: 0,
            stack: { position: new Vector3(x, 0, 0), blocks: [block] },
            stackHeight: 0,
        },
    ];
}

export function GardenPaletteCullingScene({
    batch,
    view,
    equalUniforms,
    unsupportedRange,
    legacyMerged,
    transitionWitness,
    shaderRevision,
    restoreContext,
    onReadback,
}: {
    batch: boolean;
    view: GardenPaletteCullingView;
    equalUniforms: boolean;
    unsupportedRange: boolean;
    legacyMerged: boolean;
    transitionWitness: boolean;
    shaderRevision: number;
    restoreContext: boolean;
    onReadback: (result: GardenPaletteCullingReadback) => void;
}) {
    const { scene, gl, camera } = useThree();
    const registry = useRef<StaticRenderPacketRegistry | null>(null);
    const bindRegistry = useCallback(
        (value: StaticRenderPacketRegistry | null) => {
            registry.current = value;
        },
        [],
    );
    const light = useRef<DirectionalLight>(null);
    const frame = useRef({ key: '', count: 0, reported: false });
    const receipts = useRef<Receipt[]>([]);
    const disposals = useRef(0);
    const transitionFrames = useRef<TransitionFrame[]>([]);
    const missingPresentationFrames = useRef(0);
    const resources = useMemo(() => {
        const geometry = new BoxGeometry(0.8, 0.8, 0.8);
        if (unsupportedRange) geometry.setDrawRange(0, 18);
        return {
            geometry,
            materials: ['#d84e39', '#409c6d', '#3f72b1'].map(
                (color) =>
                    new MeshStandardMaterial({
                        color: equalUniforms ? '#d84e39' : color,
                        roughness: 0.7,
                    }),
            ),
            instances: [
                instances('a', 0.5),
                instances('b', 3),
                instances('c', 6),
            ],
        };
    }, [equalUniforms, unsupportedRange]);
    const key = `${batch}:${view}${equalUniforms ? ':equal' : ''}${unsupportedRange ? ':legacy-range' : ''}${legacyMerged ? ':legacy-merged' : ''}${transitionWitness ? `:transition:${shaderRevision}:${restoreContext}` : ''}`;
    useLayoutEffect(() => {
        if (!transitionWitness || shaderRevision === 0) return;
        // Zero intensity preserves pixels while changing the real shader's
        // directional-light count, rather than only its material version.
        const addedLight = new DirectionalLight('#ffffff', 0);
        scene.add(addedLight);
        const materials = new Set<MeshStandardMaterial>();
        scene.traverse((object) => {
            if (
                object instanceof Mesh &&
                !Array.isArray(object.material) &&
                object.material.name.endsWith(':GardenStock') &&
                object.material instanceof MeshStandardMaterial
            )
                materials.add(object.material);
        });
        for (const material of materials) material.needsUpdate = true;
        return () => {
            scene.remove(addedLight);
        };
    }, [scene, shaderRevision, transitionWitness]);
    useLayoutEffect(() => {
        if (!transitionWitness || !restoreContext) return;
        gl.forceContextLoss();
        const timer = setTimeout(() => gl.forceContextRestore(), 50);
        return () => clearTimeout(timer);
    }, [gl, restoreContext, transitionWitness]);
    useLayoutEffect(() => {
        const disposed = () => disposals.current++;
        resources.geometry.addEventListener('dispose', disposed);
        for (const material of resources.materials)
            material.addEventListener('dispose', disposed);
        return () => {
            resources.geometry.removeEventListener('dispose', disposed);
            for (const material of resources.materials)
                material.removeEventListener('dispose', disposed);
            resources.geometry.dispose();
            for (const material of resources.materials) material.dispose();
        };
    }, [resources]);
    useLayoutEffect(() => {
        if (!(camera instanceof OrthographicCamera))
            throw new Error('Culling witness requires orthographic camera');
        const center =
            view === 'all'
                ? 3
                : view === 'none'
                  ? 15
                  : view === 'opposite'
                    ? 6
                    : 0.5;
        const half = view === 'all' ? 7 : 1;
        camera.position.set(center, 0, 8);
        camera.lookAt(center, 0, 0);
        camera.left = -half;
        camera.right = half;
        camera.top = half * 0.75;
        camera.bottom = -half * 0.75;
        camera.zoom = 1;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);
        if (light.current) {
            const shadowCenter =
                view === 'all'
                    ? 3
                    : view === 'none'
                      ? 15
                      : view === 'opposite'
                        ? 0.5
                        : 6;
            light.current.position.set(shadowCenter, 0, 8);
            light.current.target.position.set(shadowCenter, 0, 0);
            light.current.target.updateMatrixWorld(true);
            const shadow = light.current.shadow.camera;
            shadow.left = -half;
            shadow.right = half;
            shadow.top = half;
            shadow.bottom = -half;
            shadow.updateProjectionMatrix();
        }
    }, [camera, view]);
    useLayoutEffect(() => {
        const original = gl.renderBufferDirect;
        const programIds = new WeakMap<WebGLProgram, number>();
        let nextProgramId = 0;
        const programState = (material: unknown) => {
            const properties: unknown = gl.properties.get(material);
            const program: unknown =
                properties !== null &&
                typeof properties === 'object' &&
                'currentProgram' in properties
                    ? properties.currentProgram
                    : undefined;
            if (
                program === null ||
                typeof program !== 'object' ||
                !('program' in program) ||
                !(program.program instanceof WebGLProgram) ||
                !('isReady' in program) ||
                typeof program.isReady !== 'function'
            )
                return { id: null, ready: null };
            let id = programIds.get(program.program);
            if (id === undefined) {
                id = ++nextProgramId;
                programIds.set(program.program, id);
            }
            return { id, ready: program.isReady.call(program) === true };
        };
        const observed: typeof original = (...args) => {
            const [drawCamera, , geometry, material, object] = args;
            const tracked =
                object instanceof Mesh &&
                (object.name.startsWith('MergedBlockChunk:culling:') ||
                    object.name.startsWith('BlockInstances:culling:') ||
                    object.name.startsWith('StaticRenderPacket:'));
            const calls = gl.info.render.calls,
                triangles = gl.info.render.triangles;
            const range = { ...geometry.drawRange };
            const before =
                tracked && transitionWitness
                    ? programState(material)
                    : { id: null, ready: null };
            original.apply(gl, args);
            if (tracked) {
                const after = transitionWitness
                    ? programState(material)
                    : { id: null, ready: null };
                receipts.current.push({
                    name: object.name,
                    pass: drawCamera === camera ? 'main' : 'shadow',
                    start: range.start,
                    count: Math.min(
                        range.count,
                        geometry.index?.count ??
                            geometry.getAttribute('position').count,
                    ),
                    triangles: gl.info.render.triangles - triangles,
                    calls: gl.info.render.calls - calls,
                    geometry: geometry.uuid,
                    material: material.uuid,
                    nativeProgramBefore: before.id,
                    nativeReadyBefore: before.ready,
                    nativeProgramAfter: after.id,
                    nativeReadyAfter: after.ready,
                });
            }
        };
        gl.renderBufferDirect = observed;
        return () => {
            if (gl.renderBufferDirect === observed)
                gl.renderBufferDirect = original;
        };
    }, [camera, gl, transitionWitness]);
    useFrame(() => {
        if (frame.current.key !== key)
            frame.current = { key, count: 0, reported: false };
        frame.current.count++;
        receipts.current = [];
        gl.shadowMap.needsUpdate = true;
        if (light.current) light.current.shadow.needsUpdate = true;
    }, -90);
    useSceneAfterFrame(
        useCallback(() => {
            if (transitionWitness && batch) {
                const palette: Mesh[] = [],
                    fallback: Mesh[] = [];
                scene.traverse((object) => {
                    if (
                        !(object instanceof Mesh) ||
                        !object.name.startsWith('StaticRenderPacket:')
                    )
                        return;
                    if (!object.name.includes(':fallback:'))
                        palette.push(object);
                    else if (object.name.includes(':fallback:'))
                        fallback.push(object);
                });
                if (palette.length > 0) {
                    const visiblePalette = palette.filter(
                        (object) => object.visible,
                    ).length;
                    if (visiblePalette === 0 && fallback.length === 0)
                        missingPresentationFrames.current++;
                    const phase = visiblePalette === 0 ? 'pending' : 'ready';
                    const firstAffected =
                        (shaderRevision > 0 || restoreContext) &&
                        !transitionFrames.current.some(
                            (sample) =>
                                sample.phase === 'first-affected' &&
                                sample.revision === shaderRevision &&
                                sample.restored === restoreContext,
                        );
                    const capturePhase =
                        !transitionFrames.current.some(
                            (sample) =>
                                sample.phase === phase &&
                                sample.revision === shaderRevision &&
                                sample.restored === restoreContext,
                        ) &&
                        (phase === 'ready'
                            ? fallback.length === 0
                            : fallback.length === 3);
                    if (firstAffected || capturePhase) {
                        const hits = (near: number, far: number) =>
                            [0.525, 6.025].map((x) =>
                                new Raycaster(
                                    new Vector3(x, 0.035, 8),
                                    new Vector3(0, 0, -1),
                                    near,
                                    far,
                                )
                                    .intersectObjects(scene.children, true)
                                    .filter(
                                        ({ object }) =>
                                            object.name.startsWith(
                                                'StaticRenderPacket:',
                                            ) ||
                                            object.name.startsWith(
                                                'BlockInstances:culling:',
                                            ),
                                    )
                                    .map((hit) => ({
                                        distance: hit.distance,
                                        point: hit.point.toArray(),
                                        uv: hit.uv?.toArray() ?? null,
                                    })),
                            );
                        const sample = {
                            revision: shaderRevision,
                            restored: restoreContext,
                            frame: gl.info.render.frame,
                            hiddenPaletteMeshes:
                                palette.length - visiblePalette,
                            visiblePaletteMeshes: visiblePalette,
                            fallbackMeshes: fallback.length,
                            receipts: receipts.current,
                            sceneRaycastHits: hits(0, 20),
                            farRejectedHits: hits(0, 1).flat().length,
                            nearRejectedHits: hits(10, 20).flat().length,
                            rangesRestored: palette.every(
                                (mesh) =>
                                    mesh.geometry.drawRange.start === 0 &&
                                    mesh.geometry.drawRange.count >=
                                        (mesh.geometry.index?.count ??
                                            mesh.geometry.getAttribute(
                                                'position',
                                            ).count),
                            ),
                            // Read pixels in this same positive-render receipt, before
                            // React can commit the next presentation handoff.
                            png: gl.domElement.toDataURL('image/png'),
                        };
                        if (firstAffected)
                            transitionFrames.current.push({
                                ...sample,
                                phase: 'first-affected',
                            });
                        if (capturePhase)
                            transitionFrames.current.push({ ...sample, phase });
                    }
                }
            }
            if (frame.current.reported || frame.current.count < 15) return;
            const compiler = readChunkCompilerMetrics(),
                packets = readStaticRenderPacketMetrics();
            const localContributions =
                registry.current?.getSnapshot().flatMap((packet) =>
                    packet.contributions.map((contribution) => ({
                        id: contribution.id,
                        sourceBoundsCulling:
                            contribution.sourceBoundsCulling === true,
                        material: contribution.material.uuid,
                        geometry: contribution.geometry.uuid,
                    })),
                ) ?? [];
            if (
                compiler.pendingJobs > 0 ||
                packets.packetFallbackMeshes > 0 ||
                (batch && localContributions.length !== 3)
            )
                return;
            const meshes: Mesh[] = [];
            scene.traverse((object) => {
                if (
                    object instanceof Mesh &&
                    object.name.startsWith('StaticRenderPacket:')
                )
                    meshes.push(object);
            });
            const sceneRaycastHits = [0.525, 6.025].map((x) =>
                new Raycaster(
                    new Vector3(x, 0.035, 8),
                    new Vector3(0, 0, -1),
                    0,
                    20,
                )
                    .intersectObjects(scene.children, true)
                    .filter(
                        (hit) =>
                            hit.object.name.startsWith(
                                'MergedBlockChunk:culling:',
                            ) ||
                            hit.object.name.startsWith(
                                'BlockInstances:culling:',
                            ) ||
                            hit.object.name.startsWith('StaticRenderPacket:'),
                    )
                    .map((hit) => ({
                        distance: hit.distance,
                        point: hit.point.toArray(),
                        uv: hit.uv?.toArray() ?? null,
                    })),
            );
            const rangesRestored = meshes.every(
                (mesh) =>
                    mesh.geometry.drawRange.start === 0 &&
                    mesh.geometry.drawRange.count >=
                        (mesh.geometry.index?.count ??
                            mesh.geometry.getAttribute('position').count),
            );
            frame.current.reported = true;
            onReadback({
                key,
                receipts: receipts.current,
                compiler,
                packets,
                localContributions,
                geometryIds: [
                    ...new Set(meshes.map((mesh) => mesh.geometry.uuid)),
                ],
                materialIds: [
                    ...new Set(
                        meshes.map((mesh) =>
                            Array.isArray(mesh.material)
                                ? 'unexpected-array'
                                : mesh.material.uuid,
                        ),
                    ),
                ],
                rangesRestored,
                sourceDisposals: disposals.current,
                borrowedMaterialIds: meshes
                    .filter(
                        (mesh) =>
                            mesh.material instanceof MeshStandardMaterial &&
                            resources.materials.includes(mesh.material),
                    )
                    .map((mesh) =>
                        Array.isArray(mesh.material)
                            ? 'array'
                            : mesh.material.uuid,
                    ),
                stockMaterialCount: meshes.filter(
                    (mesh) =>
                        !Array.isArray(mesh.material) &&
                        mesh.material.name.endsWith(':GardenStock'),
                ).length,
                frame: gl.info.render.frame,
                sceneRaycastHits,
                transitionFrames: transitionFrames.current,
                missingPresentationFrames: missingPresentationFrames.current,
                png: transitionWitness
                    ? gl.domElement.toDataURL('image/png')
                    : null,
            });
        }, [
            batch,
            gl,
            key,
            onReadback,
            restoreContext,
            resources,
            scene,
            shaderRevision,
            transitionWitness,
        ]),
    );
    const content = resources.instances.map((value, index) => (
        <EntityInstancesGeometry
            key={value[0].id}
            instanceKey={`culling:${index}`}
            geometry={resources.geometry}
            material={resources.materials[index]}
            instances={value}
            batchStaticMaterial={batch}
            renderStableChunksAsMergedGeometry={
                unsupportedRange || legacyMerged
            }
            renderSnow={false}
            castShadow
            receiveShadow
        />
    ));
    return (
        <>
            <color attach="background" args={['#d0dce3']} />
            <ambientLight intensity={0.6} />
            <directionalLight
                ref={light}
                position={[6, 0, 8]}
                intensity={2}
                castShadow
                shadow-mapSize={[256, 256]}
                shadow-camera-near={0.1}
                shadow-camera-far={20}
                shadow-bias={-0.001}
            />
            <mesh position={[3, 0, -0.5]} receiveShadow>
                <planeGeometry args={[25, 12]} />
                <meshStandardMaterial color="#898577" roughness={1} />
            </mesh>
            <StaticRenderPacketBatchProvider>
                <RootRegistryWitness onRegistry={bindRegistry} />
                {content}
            </StaticRenderPacketBatchProvider>
        </>
    );
}

function RootRegistryWitness({
    onRegistry,
}: {
    onRegistry: (registry: StaticRenderPacketRegistry | null) => void;
}) {
    const registry = useStaticRenderPacketRegistry();
    useLayoutEffect(() => {
        onRegistry(registry);
        return () => onRegistry(null);
    }, [onRegistry, registry]);
    return null;
}
