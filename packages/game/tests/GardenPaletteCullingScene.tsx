import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import {
    BoxGeometry,
    type DirectionalLight,
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
import { StaticRenderPacketBatchProvider } from '../src/scene/compiler/StaticRenderPacketBatch';
import { readStaticRenderPacketMetrics } from '../src/scene/compiler/staticRenderPackets';
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
};
export type GardenPaletteCullingReadback = {
    key: string;
    receipts: Receipt[];
    compiler: ReturnType<typeof readChunkCompilerMetrics>;
    packets: ReturnType<typeof readStaticRenderPacketMetrics>;
    geometryIds: string[];
    materialIds: string[];
    rangesRestored: boolean;
    sourceDisposals: number;
    frame: number;
    sceneRaycastHits: {
        distance: number;
        point: number[];
        uv: number[] | null;
    }[][];
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
    onReadback,
}: {
    batch: boolean;
    view: GardenPaletteCullingView;
    onReadback: (result: GardenPaletteCullingReadback) => void;
}) {
    const { scene, gl, camera } = useThree();
    const light = useRef<DirectionalLight>(null);
    const frame = useRef({ key: '', count: 0, reported: false });
    const receipts = useRef<Receipt[]>([]);
    const disposals = useRef(0);
    const resources = useMemo(
        () => ({
            geometry: new BoxGeometry(0.8, 0.8, 0.8),
            materials: ['#d84e39', '#409c6d', '#3f72b1'].map(
                (color) => new MeshStandardMaterial({ color, roughness: 0.7 }),
            ),
            instances: [
                instances('a', 0.5),
                instances('b', 3),
                instances('c', 6),
            ],
        }),
        [],
    );
    const key = `${batch}:${view}`;
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
        const observed: typeof original = (...args) => {
            const [drawCamera, , geometry, material, object] = args;
            const tracked =
                object instanceof Mesh &&
                (object.name.startsWith('BlockInstances:culling:') ||
                    object.name.startsWith('StaticRenderPacket:'));
            const calls = gl.info.render.calls,
                triangles = gl.info.render.triangles;
            const range = { ...geometry.drawRange };
            original.apply(gl, args);
            if (tracked)
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
                });
        };
        gl.renderBufferDirect = observed;
        return () => {
            if (gl.renderBufferDirect === observed)
                gl.renderBufferDirect = original;
        };
    }, [camera, gl]);
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
            if (frame.current.reported || frame.current.count < 15) return;
            const compiler = readChunkCompilerMetrics(),
                packets = readStaticRenderPacketMetrics();
            if (
                compiler.pendingJobs > 0 ||
                packets.packetFallbackMeshes > 0 ||
                (batch && packets.contributions !== 3)
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
                frame: gl.info.render.frame,
                sceneRaycastHits,
            });
        }, [batch, gl, key, onReadback, scene]),
    );
    const content = resources.instances.map((value, index) => (
        <EntityInstancesGeometry
            key={value[0].id}
            instanceKey={`culling:${index}`}
            geometry={resources.geometry}
            material={resources.materials[index]}
            instances={value}
            batchStaticMaterial={batch}
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
                {content}
            </StaticRenderPacketBatchProvider>
        </>
    );
}
