import { useFrame, useThree } from '@react-three/fiber';
import {
    StrictMode,
    Suspense,
    useCallback,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    DataTexture,
    Mesh,
    MeshStandardMaterial,
    RGBAFormat,
    Texture,
    Vector2,
    Vector3,
    Vector4,
} from 'three';
import {
    type EntityBlockInstance,
    EntityInstancesGeometry,
} from '../src/entities/EntityInstancesBlock';
import { useGroundPatchMaterial } from '../src/entities/helpers/groundPatchMaterial';
import {
    releaseCloudShadowAttenuationMaterials,
    syncCloudShadowAttenuationMaterials,
} from '../src/scene/cloudShadowAttenuation';
import { readChunkCompilerMetrics } from '../src/scene/compiler/chunkCompilerMetrics';
import { StaticRenderPacketBatchProvider } from '../src/scene/compiler/StaticRenderPacketBatch';
import { readGardenPacketMaterialLifetime } from '../src/scene/gardenPacketMaterialLifetime';
import { useGardenPacketSource } from '../src/scene/gardenPacketMaterials';
import { Scene } from '../src/scene/Scene';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import { useGameGLTF } from '../src/utils/useGameGLTF';
import { GardenPacketNativeProgramWitness } from './gardenPacketNativeProgramWitness';

type Readback = { key: string; [key: string]: unknown };
declare global {
    interface Window {
        gardenPacketLifetimeWitness?: {
            read: () => Readback;
            loseContext: () => void;
            restoreContext: () => void;
            stopObserving: () => void;
        };
    }
}
type NativeObservation = {
    witness: GardenPacketNativeProgramWitness;
    stop?: () => void;
};

function NativeObservationRoot({
    observation,
}: {
    observation: NativeObservation;
}) {
    const { gl, camera } = useThree();
    useLayoutEffect(() => {
        observation.stop?.();
        observation.stop = observation.witness.install(gl, camera);
        // Keep observing through final Scene cleanup; the test closes it after readback.
    }, [camera, gl, observation]);
    return null;
}

const pendingForever = new Promise(() => {});

function AbortedSoil({
    source,
    geometry,
}: {
    source: MeshStandardMaterial;
    geometry: Mesh['geometry'];
}): never {
    useGardenPacketSource(geometry, source, true);
    throw pendingForever;
}

function Soil({ wetStrength }: { wetStrength: number }) {
    const { nodes, materials } = useGameGLTF('RaisedBed');
    const material = useGroundPatchMaterial(
        materials['Material.Dirt'],
        'raisedBedSoil',
        {
            wetStrength,
            wetPatches: [{ center: [0, 0], halfSize: [8, 8], strength: 1 }],
        },
    );
    const instances = useMemo<EntityBlockInstance[]>(
        () =>
            [-3, 3].map((x) => {
                const block = {
                    id: `soil:${x}`,
                    name: 'RaisedBed',
                    rotation: 0,
                };
                return {
                    block,
                    blockIndex: 0,
                    id: block.id,
                    pickupOutlineVisible: false,
                    position: [x, 0, 0],
                    rotation: 0,
                    stack: { position: new Vector3(x, 0, 0), blocks: [block] },
                    stackHeight: 0,
                };
            }),
        [],
    );
    return (
        <EntityInstancesGeometry
            instanceKey="admission:resident-soil"
            instances={instances}
            geometry={nodes.Raised_Bed_O_2.geometry}
            material={material}
            batchStaticMaterial
            renderSnow={false}
        />
    );
}

function LifetimeScene({
    mounted,
    wetStrength,
    cloudStrength,
    aborted,
    onReadback,
    observation,
}: {
    mounted: boolean;
    wetStrength: number;
    cloudStrength: number;
    aborted: boolean;
    onReadback: (result: Readback) => void;
    observation: NativeObservation;
}) {
    const { gl, scene, camera } = useThree();
    // A real loader consumer keeps the original resident across content replacement.
    const { nodes, materials } = useGameGLTF('RaisedBed');
    const witness = observation.witness;
    const stopBorrowedWitness = useRef<(() => void) | undefined>(undefined);
    const nativeOwners = useRef(
        new Map<MeshStandardMaterial, { disposed: boolean }>(),
    );
    const counts = useRef({
        ownedCreated: 0,
        ownedDisposed: 0,
        borrowedDisposed: 0,
        contextLost: 0,
        contextRestored: 0,
    });
    const tracked = useRef(new Set<MeshStandardMaterial>());
    const cloud = useMemo(() => {
        const map = new DataTexture(
            new Uint8Array([255, 255, 255, 255]),
            1,
            1,
            RGBAFormat,
        );
        map.needsUpdate = true;
        const alternateMap = new DataTexture(
            new Uint8Array([180, 180, 180, 255]),
            1,
            1,
            RGBAFormat,
        );
        alternateMap.needsUpdate = true;
        return {
            map,
            alternateMap,
            leases: new Map<
                string,
                { material: MeshStandardMaterial; release: () => void }
            >(),
            uniforms: {
                bounds: { value: new Vector4(-20, -20, 1 / 40, 1 / 40) },
                hardness: { value: 0 },
                map: { value: map },
                projection: { value: new Vector2() },
                strength: { value: 0 },
            },
        };
    }, []);
    const key = `${mounted}:${wetStrength}:${cloudStrength}:${aborted}`;
    const epoch = useRef({ key: '', frames: 0, reported: false });
    const latest = useRef<Readback>({ key: '' });
    const firstMainUniforms = useRef(
        new Map<
            string,
            {
                material: string;
                cacheKey: string;
                cloud: unknown;
                wet: unknown;
                bounds: unknown;
                projection: unknown;
                hardness: unknown;
                mapMatches: boolean | undefined;
            }
        >(),
    );
    useLayoutEffect(() => {
        // StrictMode setup replaces the previous observer. Final cleanup keeps
        // native deletion observation alive until the test reads the closed root.
        stopBorrowedWitness.current?.();
        const original = gl.renderBufferDirect;
        gl.renderBufferDirect = (...args) => {
            const material = args[3];
            if (
                material instanceof MeshStandardMaterial &&
                !nativeOwners.current.has(material)
            ) {
                const owner = { disposed: false };
                nativeOwners.current.set(material, owner);
                material.addEventListener('dispose', () => {
                    owner.disposed = true;
                });
            }
            if (
                material instanceof MeshStandardMaterial &&
                material.name.endsWith(':GardenStock') &&
                !tracked.current.has(material)
            ) {
                tracked.current.add(material);
                counts.current.ownedCreated++;
                material.addEventListener(
                    'dispose',
                    () => counts.current.ownedDisposed++,
                );
            }
            const before = gl.info.render.calls;
            original.apply(gl, args);
            if (
                args[0] === camera &&
                gl.info.render.calls > before &&
                material.name.endsWith(':GardenStock') &&
                !firstMainUniforms.current.has(material.uuid)
            ) {
                const properties: unknown = gl.properties.get(material);
                const program: unknown =
                    typeof properties === 'object' && properties !== null
                        ? Reflect.get(properties, 'currentProgram')
                        : undefined;
                const native: unknown =
                    typeof program === 'object' && program !== null
                        ? Reflect.get(program, 'program')
                        : undefined;
                const cacheKey: unknown =
                    typeof program === 'object' && program !== null
                        ? Reflect.get(program, 'cacheKey')
                        : undefined;
                if (
                    !(native instanceof WebGLProgram) ||
                    typeof cacheKey !== 'string'
                )
                    throw new Error(
                        'First positive native submission is required.',
                    );
                const gpuUniform = (name: string): unknown => {
                    const location = gl
                        .getContext()
                        .getUniformLocation(native, name);
                    return location
                        ? gl.getContext().getUniform(native, location)
                        : undefined;
                };
                const vector = (name: string) => {
                    const value = gpuUniform(name);
                    return value instanceof Float32Array
                        ? [...value]
                        : undefined;
                };
                const sampler = gpuUniform('grediceCloudShadowMap');
                let mapMatches: boolean | undefined;
                if (typeof sampler === 'number' && Number.isInteger(sampler)) {
                    const context = gl.getContext();
                    const activeTexture: unknown = context.getParameter(
                        context.ACTIVE_TEXTURE,
                    );
                    if (typeof activeTexture !== 'number')
                        throw new Error(
                            'Actual texture unit state is required.',
                        );
                    const textureProperties: unknown = gl.properties.get(
                        cloud.uniforms.map.value,
                    );
                    const uploaded: unknown =
                        typeof textureProperties === 'object' &&
                        textureProperties !== null
                            ? Reflect.get(textureProperties, '__webglTexture')
                            : undefined;
                    context.activeTexture(context.TEXTURE0 + sampler);
                    try {
                        mapMatches =
                            uploaded instanceof WebGLTexture &&
                            context.getParameter(context.TEXTURE_BINDING_2D) ===
                                uploaded;
                    } finally {
                        context.activeTexture(activeTexture);
                    }
                }
                firstMainUniforms.current.set(material.uuid, {
                    material: material.uuid,
                    cacheKey,
                    cloud: gpuUniform('grediceCloudShadowStrength'),
                    wet: gpuUniform('uGroundPatchWetStrength'),
                    bounds: vector('grediceCloudShadowBounds'),
                    projection: vector('grediceCloudShadowProjection'),
                    hardness: gpuUniform('grediceCloudShadowHardness'),
                    mapMatches,
                });
            }
        };
        const disposed = () => counts.current.borrowedDisposed++;
        const source = materials['Material.Dirt'];
        const geometry = nodes.Raised_Bed_O_2.geometry;
        source.addEventListener('dispose', disposed);
        geometry.addEventListener('dispose', disposed);
        const borrowedTextures = Object.values(source).filter(
            (value): value is Texture => value instanceof Texture,
        );
        for (const texture of borrowedTextures)
            texture.addEventListener('dispose', disposed);
        stopBorrowedWitness.current = () => {
            source.removeEventListener('dispose', disposed);
            geometry.removeEventListener('dispose', disposed);
            for (const texture of borrowedTextures)
                texture.removeEventListener('dispose', disposed);
        };
        const lost = () => counts.current.contextLost++;
        const restored = () => counts.current.contextRestored++;
        gl.domElement.addEventListener('webglcontextlost', lost);
        gl.domElement.addEventListener('webglcontextrestored', restored);
        window.gardenPacketLifetimeWitness = {
            read: () => ({
                ...latest.current,
                counts: { ...counts.current },
                lifetime: readGardenPacketMaterialLifetime(scene),
                nativePrograms: witness.read(),
                resources: {
                    programs: gl.info.programs?.map((program) => ({
                        cacheKey: program.cacheKey,
                        usedTimes: program.usedTimes,
                    })),
                    owners: [...nativeOwners.current].map(
                        ([material, owner]) => {
                            const properties: unknown =
                                gl.properties.get(material);
                            const programs: unknown =
                                typeof properties === 'object' &&
                                properties !== null
                                    ? Reflect.get(properties, 'programs')
                                    : undefined;
                            return {
                                uuid: material.uuid,
                                name: material.name,
                                disposed: owner.disposed,
                                programKeys:
                                    programs instanceof Map
                                        ? [...programs.keys()]
                                        : [],
                            };
                        },
                    ),
                },
            }),
            loseContext: () => gl.forceContextLoss(),
            restoreContext: () => gl.forceContextRestore(),
            stopObserving: () => {
                observation.stop?.();
                observation.stop = undefined;
                stopBorrowedWitness.current?.();
                stopBorrowedWitness.current = undefined;
            },
        };
        return () => {
            releaseCloudShadowAttenuationMaterials(cloud.leases);
            gl.domElement.removeEventListener('webglcontextlost', lost);
            gl.domElement.removeEventListener('webglcontextrestored', restored);
            gl.renderBufferDirect = original;
        };
    }, [camera, cloud, gl, materials, nodes, observation, scene, witness]);
    useFrame(() => {
        if (epoch.current.key !== key) {
            epoch.current = { key, frames: 0, reported: false };
            firstMainUniforms.current.clear();
        }
        witness.setEpoch(key);
        cloud.uniforms.strength.value = cloudStrength;
        cloud.uniforms.map.value =
            cloudStrength > 0.5 ? cloud.alternateMap : cloud.map;
        if (cloudStrength > 0.5)
            cloud.uniforms.bounds.value.set(-10, -10, 0.04, 0.04);
        else cloud.uniforms.bounds.value.set(-20, -20, 0.025, 0.025);
        cloud.uniforms.projection.value.set(
            cloudStrength > 0.5 ? 0.15 : 0,
            cloudStrength > 0.5 ? -0.2 : 0,
        );
        cloud.uniforms.hardness.value = cloudStrength > 0.5 ? 0.6 : 0;
        syncCloudShadowAttenuationMaterials({
            enabled: cloudStrength !== 0,
            leases: cloud.leases,
            root: scene,
            uniforms: cloud.uniforms,
            renderer: gl,
        });
        epoch.current.frames++;
        if (
            epoch.current.frames < 20 ||
            epoch.current.reported ||
            readChunkCompilerMetrics().pendingJobs > 0 ||
            counts.current.contextLost > counts.current.contextRestored
        )
            return;
        const uniforms: {
            uuid: string;
            cloudStrength: unknown;
            wetStrength: unknown;
        }[] = [];
        scene.traverse((object) => {
            if (
                !(object instanceof Mesh) ||
                Array.isArray(object.material) ||
                !object.material.name.endsWith(':GardenStock')
            )
                return;
            const properties = gl.properties.get(object.material);
            if (typeof properties !== 'object' || properties === null) return;
            const values: unknown = Reflect.get(properties, 'uniforms');
            const uniform = (name: string) => {
                if (typeof values !== 'object' || values === null)
                    return undefined;
                const value: unknown = Reflect.get(values, name);
                return typeof value === 'object' && value !== null
                    ? Reflect.get(value, 'value')
                    : undefined;
            };
            uniforms.push({
                uuid: object.material.uuid,
                cloudStrength: uniform('grediceCloudShadowStrength'),
                wetStrength: uniform('uGroundPatchWetStrength'),
            });
        });
        latest.current = {
            key,
            programInventory: gl.info.programs?.map((program) => ({
                cacheKey: program.cacheKey,
                usedTimes: program.usedTimes,
                vertex:
                    program.vertexShader instanceof WebGLShader
                        ? gl.getContext().getShaderSource(program.vertexShader)
                        : undefined,
                fragment:
                    program.fragmentShader instanceof WebGLShader
                        ? gl
                              .getContext()
                              .getShaderSource(program.fragmentShader)
                        : undefined,
            })),
            uniforms,
            firstMainUniforms: [...firstMainUniforms.current.values()],
            counts: { ...counts.current },
            lifetime: readGardenPacketMaterialLifetime(scene),
            nativePrograms: witness.read(),
            png: gl.domElement.toDataURL('image/png'),
        };
        epoch.current.reported = true;
        onReadback(latest.current);
    });
    const original = materials['Material.Dirt'];
    if (!(original instanceof MeshStandardMaterial))
        throw new Error('Loaded Dirt must be an authored stock material.');
    return (
        <>
            <color attach="background" args={['#18222d']} />
            <ambientLight intensity={0.8} />
            <directionalLight
                position={[3, 8, 4]}
                intensity={3}
                castShadow
                shadow-mapSize={[512, 512]}
            />
            <StaticRenderPacketBatchProvider>
                {mounted && (
                    <Soil key={wetStrength} wetStrength={wetStrength} />
                )}
                {aborted && (
                    <Suspense fallback={null}>
                        <AbortedSoil
                            source={original}
                            geometry={nodes.Raised_Bed_O_2.geometry}
                        />
                    </Suspense>
                )}
            </StaticRenderPacketBatchProvider>
        </>
    );
}

export function GardenPacketLifetimeFixture({
    mounted = true,
    wetStrength = 0.4,
    cloudStrength = 0.2,
    aborted = false,
}: {
    mounted?: boolean;
    wetStrength?: number;
    cloudStrength?: number;
    aborted?: boolean;
}) {
    const [store] = useState(() =>
        createGameState({
            appBaseUrl: '',
            isMock: true,
            freezeTime: new Date('2026-07-01T12:00:00Z'),
        }),
    );
    useDisposeGameStateStore(store);
    const observation = useRef<NativeObservation>({
        witness: new GardenPacketNativeProgramWitness(),
    });
    const [result, setResult] = useState<Readback>();
    const report = useCallback((value: Readback) => setResult(value), []);
    const key = `${mounted}:${wetStrength}:${cloudStrength}:${aborted}`;
    return (
        <div
            data-testid="garden-packet-lifetime"
            data-ready={result?.key === key ? key : ''}
            data-result={JSON.stringify(result)}
            style={{ width: 512, height: 384 }}
        >
            <StrictMode>
                <GameStateContext.Provider value={store}>
                    <Scene
                        position={[0, 12, 15]}
                        zoom={34}
                        pixelRatio={1}
                        frameloop="always"
                        fixedTimeSeconds={43200}
                        baseFramesPerSecond={60}
                        adaptiveHighEnabled={false}
                        staticOpaqueCacheEnabled={false}
                        rendererOptions={{
                            alpha: false,
                            antialias: false,
                            preserveDrawingBuffer: true,
                        }}
                    >
                        <NativeObservationRoot
                            observation={observation.current}
                        />
                        <Suspense fallback={null}>
                            <LifetimeScene
                                mounted={mounted}
                                wetStrength={wetStrength}
                                cloudStrength={cloudStrength}
                                aborted={aborted}
                                onReadback={report}
                                observation={observation.current}
                            />
                        </Suspense>
                    </Scene>
                </GameStateContext.Provider>
            </StrictMode>
        </div>
    );
}
