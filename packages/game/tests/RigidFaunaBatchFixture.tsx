import { useFrame, useThree } from '@react-three/fiber';
import {
    type RefObject,
    Suspense,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { type Group, InstancedMesh, Mesh } from 'three';
import { useActorGroundingShadow } from '../src/entities/animals/ActorGroundingShadows';
import { useFaunaRenderFrame } from '../src/entities/animals/FaunaRuntimeProvider';
import { useFaunaActorCulling } from '../src/entities/animals/useFaunaActorCulling';
import {
    gameQualityProfiles,
    resolveGameQualityProfile,
} from '../src/scene/gameQuality';
import { Scene } from '../src/scene/Scene';
import { useSceneAfterFrame } from '../src/scene/useSceneAfterFrame';
import {
    createGameState,
    GameStateContext,
    useDisposeGameStateStore,
} from '../src/useGameState';
import { useGameGLTF } from '../src/utils/useGameGLTF';

const parents = {
    Bee: ['Bee_HeadPivot', 'Bee_BodyPivot'],
    Ladybug: [
        'Ladybug_ElytraPivot_L',
        'Ladybug_ElytraPivot_R',
        'Ladybug_HeadPivot',
        'Ladybug_BodyPivot',
    ],
};

function Model({
    asset,
    batch,
    pose,
}: {
    asset: keyof typeof parents;
    batch: boolean;
    pose: number;
}) {
    const gltf = useGameGLTF(asset);
    const group = useRef<Group>(null);
    const updateShadow = useActorGroundingShadow({
        id: asset,
        species: asset === 'Bee' ? 'bee' : 'ladybug',
        primaryCasterCount: 0,
    });
    const model = useMemo(() => {
        const clone = gltf.scene.clone(true);
        clone.name = `RigidModel:${asset}`;
        clone.traverse((object) => {
            if (object instanceof Mesh) {
                object.castShadow = false;
                object.receiveShadow = true;
            }
        });
        return clone;
    }, [asset, gltf.scene]);
    useLayoutEffect(() => {
        for (const [index, name] of parents[asset].entries()) {
            const pivot = model.getObjectByName(name);
            if (pivot) pivot.rotation.y = pose * (index % 2 ? -0.4 : 0.3);
        }
    }, [asset, model, pose]);
    useFaunaActorCulling(model, {
        rigidSource: batch ? gltf.scene : undefined,
        rigidParents: parents[asset],
    });
    useFaunaRenderFrame(() => {
        if (!group.current || !updateShadow) return;
        updateShadow({
            actorY: group.current.position.y,
            receiverY: 0,
            visible: true,
            x: group.current.position.x,
            z: group.current.position.z,
            yaw: group.current.rotation.y,
        });
    });
    return (
        <group
            ref={group}
            position={[asset === 'Bee' ? -0.85 : 0.85, 0.12, 0]}
            rotation={[0, pose * 0.6, 0]}
            scale={1.6}
        >
            <primitive object={model} />
        </group>
    );
}

function Probe({
    output,
    marker,
    batch,
}: {
    output: RefObject<HTMLOutputElement | null>;
    marker: string;
    batch: boolean;
}) {
    const { gl, scene, camera } = useThree();
    const frames = useRef({ marker, count: 0 });
    useLayoutEffect(() => {
        frames.current = { marker, count: 0 };
        camera.lookAt(0, 0.45, 0);
        camera.updateMatrixWorld();
    }, [camera, marker]);
    useFrame(() => {
        frames.current.count++;
    });
    useSceneAfterFrame(() => {
        let batchCount = 0;
        const geometryIds: string[] = [];
        scene.traverse((object) => {
            if (
                object instanceof Mesh &&
                object.name.startsWith('FaunaRigidBatch:')
            ) {
                batchCount++;
                geometryIds.push(object.geometry.uuid);
            }
        });
        const ready =
            frames.current.marker === marker &&
            frames.current.count >= 3 &&
            scene.getObjectByName('RigidModel:Bee') &&
            scene.getObjectByName('RigidModel:Ladybug') &&
            batchCount === (batch ? 7 : 0);
        if (!output.current || !ready) return;
        const shadows = scene.getObjectByName('ActorGroundingShadows');
        output.current.dataset.ready = marker;
        output.current.dataset.result = JSON.stringify({
            calls: gl.info.render.calls,
            triangles: gl.info.render.triangles,
            batchCount,
            geometryIds,
            shadowCount: shadows instanceof InstancedMesh ? shadows.count : 0,
        });
    });
    return null;
}

export function RigidFaunaBatchFixture({
    appBaseUrl,
    batch,
    pose = 0,
    quality = 'high',
    night = false,
}: {
    appBaseUrl: string;
    batch: boolean;
    pose?: number;
    quality?: keyof typeof gameQualityProfiles | 'auto' | 'auto-constrained';
    night?: boolean;
}) {
    const [store] = useState(() =>
        createGameState({
            appBaseUrl,
            isMock: true,
            authenticatedGardenQueriesEnabled: false,
            freezeTime: new Date('2026-06-01T12:00:00Z'),
        }),
    );
    useDisposeGameStateStore(store);
    const output = useRef<HTMLOutputElement>(null);
    const marker = `${batch}:${pose}:${quality}:${night}`;
    return (
        <div data-testid="rigid-fauna" style={{ width: 640, height: 384 }}>
            <output ref={output} data-testid="rigid-receipt" />
            <GameStateContext.Provider value={store}>
                <Scene
                    position={[4, 3, 6]}
                    zoom={155}
                    pixelRatio={1}
                    quality={
                        quality === 'auto' || quality === 'auto-constrained'
                            ? resolveGameQualityProfile('auto', undefined, {
                                  coarsePointer: false,
                                  coreCount: quality === 'auto' ? 8 : 4,
                                  dpr: 2,
                                  memoryGb: quality === 'auto' ? 8 : 4,
                                  narrowViewport: false,
                              })
                            : gameQualityProfiles[quality]
                    }
                    baseFramesPerSecond={60}
                    fixedTimeSeconds={43200}
                    suspendWhenOffscreen={false}
                    rendererOptions={{
                        antialias: false,
                        preserveDrawingBuffer: true,
                    }}
                >
                    <ambientLight intensity={night ? 0.15 : 0.8} />
                    <directionalLight
                        castShadow
                        position={[3, 7, 4]}
                        intensity={night ? 0.6 : 3}
                        shadow-mapSize={[2048, 2048]}
                    />
                    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                        <planeGeometry args={[8, 8]} />
                        <meshStandardMaterial color="#b8ad83" />
                    </mesh>
                    <Suspense fallback={null}>
                        <Model asset="Bee" batch={batch} pose={pose} />
                        <Model asset="Ladybug" batch={batch} pose={pose} />
                    </Suspense>
                    <Probe output={output} marker={marker} batch={batch} />
                </Scene>
            </GameStateContext.Provider>
        </div>
    );
}
