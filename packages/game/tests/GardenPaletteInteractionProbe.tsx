import {
    type RootState,
    useFrame,
    useStore,
    useThree,
} from '@react-three/fiber';
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import {
    type BufferGeometry,
    DirectionalLight,
    Light,
    type Material,
    Mesh,
    MeshStandardMaterial,
    type Object3D,
    ShaderMaterial,
    Vector3,
} from 'three';
import { useEntityBlockInstances } from '../src/entities/EntityInstancesBlock';
import type { GLTFResult } from '../src/models/GameAssets';
import { readChunkCompilerMetrics } from '../src/scene/compiler/chunkCompilerMetrics';
import { readStaticRenderPacketMetrics } from '../src/scene/compiler/staticRenderPackets';
import { useSceneTimeUniform } from '../src/scene/SceneTime';
import { getSceneRootRuntime } from '../src/scene/sceneRootRuntime';
import { SceneSpringValue } from '../src/scene/sceneSpring';
import { useSceneAfterFrame } from '../src/scene/useSceneAfterFrame';
import type { Stack } from '../src/types/Stack';
import { useGameStateStore } from '../src/useGameState';
import type { GardenPaletteInteractionPhase } from './GardenPaletteInteractionFixture';

type DropNativeDraw = {
    geometry: string;
    calls: number;
    triangles: number;
    originalGeometry: boolean;
};
type ActiveDropCapture = {
    readback: ReturnType<typeof readInteractionSnapshot>;
    png: string;
    deltaSequence: number[];
};
type DropSpringAdvance = {
    deltaMs: number;
    before: number;
    after: number;
    performanceNow: number;
};
type WeatherEvolution = {
    frames: number;
    deltaSeconds: number;
    deltas: number[];
    firstRendererFrame: number | null;
    lastRendererFrame: number | null;
};

function isInside(object: Object3D, prefix: string) {
    let current: Object3D | null = object;
    while (current) {
        if (current.name.startsWith(prefix)) return true;
        current = current.parent;
    }
    return false;
}

function materialInputs(material: Material | Material[]) {
    return (Array.isArray(material) ? material : [material]).map((value) =>
        value instanceof MeshStandardMaterial
            ? {
                  color: value.color.toArray(),
                  emissive: value.emissive.toArray(),
                  roughness: value.roughness,
                  metalness: value.metalness,
                  opacity: value.opacity,
                  alphaTest: value.alphaTest,
                  maps: [
                      value.map?.uuid ?? null,
                      value.alphaMap?.uuid ?? null,
                      value.roughnessMap?.uuid ?? null,
                      value.metalnessMap?.uuid ?? null,
                      value.emissiveMap?.uuid ?? null,
                  ],
              }
            : { type: value.type },
    );
}

function weatherUniformInputs(gl: RootState['gl'], material: Material) {
    const properties: unknown = gl.properties.get(material);
    const uniforms: unknown =
        material instanceof ShaderMaterial
            ? material.uniforms
            : properties !== null &&
                typeof properties === 'object' &&
                'uniforms' in properties
              ? properties.uniforms
              : undefined;
    if (uniforms === null || typeof uniforms !== 'object') return {};
    return Object.fromEntries(
        Object.entries(uniforms)
            .filter(([key]) =>
                /Rain|Wet|Puddle|Darkness|Glossiness|Bounds|Frost|Time/.test(
                    key,
                ),
            )
            .map(([key, uniform]) => {
                const value: unknown =
                    uniform !== null &&
                    typeof uniform === 'object' &&
                    'value' in uniform
                        ? uniform.value
                        : undefined;
                return [
                    key,
                    typeof value === 'number'
                        ? value
                        : value instanceof Vector3
                          ? value.toArray()
                          : null,
                ];
            }),
    );
}

export function GardenPaletteInteractionProbe({
    batch,
    phase,
    stacks,
    tree,
    box,
}: {
    batch: boolean;
    phase: GardenPaletteInteractionPhase;
    stacks: Stack[];
    tree: GLTFResult;
    box: GLTFResult;
}) {
    const scene = useThree((state) => state.scene);
    const gl = useThree((state) => state.gl);
    const camera = useThree((state) => state.camera);
    const clock = useThree((state) => state.clock);
    const time = useSceneTimeUniform();
    const runtime = getSceneRootRuntime(useStore());
    const store = useGameStateStore();
    const instances = useEntityBlockInstances({
        name: 'Tree',
        stacks,
        yOffset: 0.5,
    });
    const receipts = useRef(0);
    const lastDelta = useRef(0);
    const springStarted = useRef(false);
    const dropNativeDraws = useRef<DropNativeDraw[]>([]);
    const rainNativeDraws = useRef(new Set<string>());
    const activeDrop = useRef<ActiveDropCapture | undefined>(undefined);
    const dropDeltas = useRef<number[]>([]);
    const pendingDropAdvances = useRef<DropSpringAdvance[]>([]);
    const dropSpringAdvances = useRef<DropSpringAdvance[]>([]);
    const weatherEvolution = useRef<WeatherEvolution>({
        frames: 0,
        deltaSeconds: 0,
        deltas: [],
        firstRendererFrame: null,
        lastRendererFrame: null,
    });
    const renderedTiming = useRef({
        performanceNow: 0,
        dateNow: 0,
        elapsedTime: 0,
        delta: 0,
    });
    useFrame((_, delta) => {
        lastDelta.current = delta;
        dropNativeDraws.current = [];
        rainNativeDraws.current.clear();
    });
    const sourceDisposals = useRef(0);
    const sources = useMemo(
        () => [
            tree.nodes.Tree_1_1,
            box.nodes.GardenBox_Body_Planks,
            box.nodes.GardenBox_Lid_HingeOrigin,
        ],
        [box, tree],
    );
    useLayoutEffect(() => {
        if (phase !== 'drop') {
            springStarted.current = false;
            activeDrop.current = undefined;
            dropDeltas.current = [];
            pendingDropAdvances.current = [];
            dropSpringAdvances.current = [];
        }
    }, [phase]);
    useLayoutEffect(() => {
        // Observe the exact public spring input without changing its arguments,
        // scheduling or value. This fixture owns a single active drop spring.
        const original = SceneSpringValue.prototype.advance;
        const observed: typeof original = function (
            this: SceneSpringValue<unknown>,
            deltaMs,
        ) {
            const before: unknown = this.get();
            const result = original.call(this, deltaMs);
            const after: unknown = this.get();
            if (
                this.key === 'dropOffsetY' &&
                typeof before === 'number' &&
                typeof after === 'number'
            )
                pendingDropAdvances.current.push({
                    deltaMs,
                    before,
                    after,
                    performanceNow: performance.now(),
                });
            return result;
        };
        SceneSpringValue.prototype.advance = observed;
        return () => {
            if (SceneSpringValue.prototype.advance === observed)
                SceneSpringValue.prototype.advance = original;
        };
    }, []);
    useLayoutEffect(() => {
        const original = runtime.startAnimation;
        const observed: typeof original = (animation) => {
            if ('key' in animation && animation.key === 'dropOffsetY')
                springStarted.current = true;
            original(animation);
        };
        runtime.startAnimation = observed;
        return () => {
            if (runtime.startAnimation === observed)
                runtime.startAnimation = original;
        };
    }, [runtime]);
    useLayoutEffect(() => {
        const original = gl.renderBufferDirect;
        const originals = new Set(sources.map((source) => source.geometry));
        const observed: typeof original = (...args) => {
            const [drawCamera, , geometry, material, object] = args;
            const calls = gl.info.render.calls,
                triangles = gl.info.render.triangles;
            original.apply(gl, args);
            if (
                drawCamera === camera &&
                material instanceof ShaderMaterial &&
                'uWetness' in material.uniforms &&
                gl.info.render.calls > calls
            )
                rainNativeDraws.current.add(object.uuid);
            if (
                drawCamera === camera &&
                isInside(object, 'Animation:PlacementDrop:Tree:') &&
                gl.info.render.calls > calls
            )
                dropNativeDraws.current.push({
                    geometry: geometry.uuid,
                    calls: gl.info.render.calls - calls,
                    triangles: gl.info.render.triangles - triangles,
                    originalGeometry: originals.has(geometry),
                });
        };
        gl.renderBufferDirect = observed;
        return () => {
            if (gl.renderBufferDirect === observed)
                gl.renderBufferDirect = original;
        };
    }, [camera, gl, sources]);
    useLayoutEffect(() => {
        const resources = new Set<BufferGeometry | Material>();
        for (const source of sources) {
            resources.add(source.geometry);
            for (const material of Array.isArray(source.material)
                ? source.material
                : [source.material])
                resources.add(material);
        }
        const disposed = () => sourceDisposals.current++;
        for (const resource of resources)
            resource.addEventListener('dispose', disposed);
        return () => {
            for (const resource of resources)
                resource.removeEventListener('dispose', disposed);
        };
    }, [sources]);
    const snapshot = useCallback(
        () =>
            readInteractionSnapshot({
                batch,
                phase,
                scene,
                gl,
                camera,
                sceneTimeSeconds: time.value,
                renderedTiming: renderedTiming.current,
                sources,
                store,
                instances,
                receipts: receipts.current,
                sourceDisposals: sourceDisposals.current,
                springStarted: springStarted.current,
                dropNativeDraws: dropNativeDraws.current,
                dropSpringAdvances: dropSpringAdvances.current,
                weatherEvolution: weatherEvolution.current,
                rainOverlayDrawCount: rainNativeDraws.current.size,
            }),
        [batch, phase, scene, gl, camera, time, sources, store, instances],
    );
    useSceneAfterFrame(
        useCallback(() => {
            receipts.current++;
            renderedTiming.current = {
                performanceNow: performance.now(),
                dateNow: Date.now(),
                elapsedTime: clock.elapsedTime,
                delta: lastDelta.current,
            };
            let rainOverlayCount = 0;
            scene.traverse((object) => {
                if (!(object instanceof Mesh) || !object.visible) return;
                for (const material of Array.isArray(object.material)
                    ? object.material
                    : [object.material])
                    if (
                        material instanceof ShaderMaterial &&
                        'uWetness' in material.uniforms
                    )
                        rainOverlayCount++;
            });
            if (rainOverlayCount === 2 && rainNativeDraws.current.size === 2) {
                const evolution = weatherEvolution.current;
                evolution.frames++;
                evolution.deltaSeconds += lastDelta.current;
                evolution.deltas.push(lastDelta.current);
                evolution.firstRendererFrame ??= gl.info.render.frame;
                evolution.lastRendererFrame = gl.info.render.frame;
            }
            dropSpringAdvances.current = pendingDropAdvances.current.splice(0);
            if (phase === 'drop')
                dropDeltas.current.push(
                    ...dropSpringAdvances.current.map(
                        (advance) => advance.deltaMs,
                    ),
                );
            if (
                phase !== 'drop' ||
                !springStarted.current ||
                activeDrop.current ||
                dropNativeDraws.current.length === 0
            )
                return;
            const value = snapshot();
            if (
                value.dropOffsetY !== null &&
                value.dropOffsetY < 0.1 &&
                value.dropOffsetY > 0
            )
                activeDrop.current = {
                    readback: structuredClone(value),
                    png: gl.domElement.toDataURL('image/png'),
                    deltaSequence: [...dropDeltas.current],
                };
        }, [clock, phase, snapshot, gl, scene]),
    );
    useLayoutEffect(() => {
        const witness = {
            snapshot,
            capture: () => ({
                readback: structuredClone(snapshot()),
                png: gl.domElement.toDataURL('image/png'),
            }),
            activeDrop: () => activeDrop.current,
        };
        window.gardenPaletteInteractionWitness = witness;
        return () => {
            if (window.gardenPaletteInteractionWitness === witness)
                delete window.gardenPaletteInteractionWitness;
        };
    });
    return null;
}

function readInteractionSnapshot({
    batch,
    phase,
    scene,
    gl,
    camera,
    sceneTimeSeconds,
    renderedTiming,
    sources,
    store,
    instances,
    receipts,
    sourceDisposals,
    springStarted,
    dropNativeDraws,
    dropSpringAdvances,
    weatherEvolution,
    rainOverlayDrawCount,
}: {
    batch: boolean;
    phase: GardenPaletteInteractionPhase;
    scene: RootState['scene'];
    gl: RootState['gl'];
    camera: RootState['camera'];
    sceneTimeSeconds: number;
    renderedTiming: {
        performanceNow: number;
        dateNow: number;
        elapsedTime: number;
        delta: number;
    };
    sources: Mesh[];
    store: ReturnType<typeof useGameStateStore>;
    instances: ReturnType<typeof useEntityBlockInstances>;
    receipts: number;
    sourceDisposals: number;
    springStarted: boolean;
    dropNativeDraws: DropNativeDraw[];
    dropSpringAdvances: DropSpringAdvance[];
    weatherEvolution: WeatherEvolution;
    rainOverlayDrawCount: number;
}) {
    const originalGeometries = new Set(sources.map((s) => s.geometry));
    const packetMeshes: Mesh[] = [];
    const animatedMeshes: Mesh[] = [];
    const outlineMeshes: Mesh[] = [];
    const authoredMeshes: Mesh[] = [];
    const weatherMeshes: Mesh[] = [];
    const lights: Light[] = [];
    scene.traverse((object) => {
        if (object instanceof Light) lights.push(object);
        if (!(object instanceof Mesh)) return;
        if (object.visible) weatherMeshes.push(object);
        if (
            object.name.startsWith('StaticRenderPacket:') &&
            !object.name.includes(':visible-range:')
        )
            packetMeshes.push(object);
        if (isInside(object, 'Animation:PlacementDrop:Tree:'))
            animatedMeshes.push(object);
        if (isInside(object, 'Interaction:HoverOutlineTarget'))
            outlineMeshes.push(object);
        if (object.name.startsWith('BlockInstances:Tree:'))
            authoredMeshes.push(object);
    });
    const drop = scene.getObjectByName(
        'Animation:PlacementDropOffset:Tree:palette-picked-tree',
    );
    const state = store.getState();
    return {
        batch,
        phase,
        receipts: receipts,
        rendererFrame: gl.info.render.frame,
        springStarted,
        dropNativeDraws,
        dropSpringAdvances,
        weatherEvolution,
        rainOverlayDrawCount,
        sceneTimeSeconds,
        renderedTiming,
        camera: {
            type: camera.type,
            matrixWorld: camera.matrixWorld.toArray(),
            projection: camera.projectionMatrix.toArray(),
        },
        lights: lights.map((value) => ({
            type: value.type,
            intensity: value.intensity,
            color: value.color.toArray(),
            matrixWorld: value.matrixWorld.toArray(),
            castShadow: value.castShadow,
            shadow:
                value instanceof DirectionalLight
                    ? {
                          matrix: value.shadow.matrix.toArray(),
                          bias: value.shadow.bias,
                          normalBias: value.shadow.normalBias,
                          mapSize: value.shadow.mapSize.toArray(),
                          cameraWorld:
                              value.shadow.camera.matrixWorld.toArray(),
                          cameraProjection:
                              value.shadow.camera.projectionMatrix.toArray(),
                      }
                    : null,
        })),
        weatherUniforms: weatherMeshes
            .map((mesh) => ({
                name: mesh.name,
                matrixWorld: mesh.matrixWorld.toArray(),
                materials: (Array.isArray(mesh.material)
                    ? mesh.material
                    : [mesh.material]
                ).map((material) => weatherUniformInputs(gl, material)),
            }))
            .filter((mesh) =>
                mesh.materials.some(
                    (uniforms) => Object.keys(uniforms).length > 0,
                ),
            ),
        sourceDisposals: sourceDisposals,
        sourceInputs: sources.map((source) => ({
            geometry: source.geometry.uuid,
            positionCount: source.geometry.getAttribute('position').count,
            indexCount: source.geometry.index?.count ?? null,
            material: materialInputs(source.material),
        })),
        compiler: readChunkCompilerMetrics(),
        packets: readStaticRenderPacketMetrics(),
        paletteMeshes: packetMeshes.filter((mesh) =>
            mesh.geometry.hasAttribute('aGardenPalette0'),
        ).length,
        pendingMeshes: packetMeshes.filter((mesh) =>
            mesh.name.includes(':fallback:'),
        ).length,
        authoredMeshes: authoredMeshes.length,
        animatedMeshes: animatedMeshes.length,
        animatedOriginalGeometry: animatedMeshes.filter((mesh) =>
            originalGeometries.has(mesh.geometry),
        ).length,
        outlineMeshes: outlineMeshes.length,
        outlineOriginalGeometry: outlineMeshes.filter((mesh) =>
            originalGeometries.has(mesh.geometry),
        ).length,
        dropOffsetY: drop?.position.y ?? null,
        dropAnimation:
            state.blockPlacementDropAnimations['palette-picked-tree'],
        treePositions: instances?.map((instance) => ({
            id: instance.block.id,
            position: instance.position,
            pickupOutlineVisible: instance.pickupOutlineVisible,
        })),
        rainSurfaceIntensity: state.rainSurfaceIntensity,
    };
}

declare global {
    interface Window {
        gardenPaletteInteractionWitness?: {
            snapshot: () => ReturnType<typeof readInteractionSnapshot>;
            capture: () => {
                readback: ReturnType<typeof readInteractionSnapshot>;
                png: string;
            };
            activeDrop: () => ActiveDropCapture | undefined;
        };
    }
}
