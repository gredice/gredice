'use client';

import { useThree } from '@react-three/fiber';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type HTMLAttributes, useEffect, useMemo, useRef } from 'react';
import type { GameAssetName } from '../data/models';
import { GameFlagsContext } from '../GameFlagsContext';
import { GameSceneDetailContext } from '../GameSceneDetailContext';
import { ParticleSystemProvider } from '../particles/ParticleSystem';
import { StaticEnvironment } from '../scene/Environment';
import { gameQualityProfiles } from '../scene/gameQuality';
import { Scene } from '../scene/Scene';
import {
    createGameState,
    GameStateContext,
    type GameStateStore,
    useDisposeGameStateStore,
} from '../useGameState';
import { useGameGLTF } from '../utils/useGameGLTF';

type SnapshotVector3 = readonly [x: number, y: number, z: number];

type MutableVector3 = [x: number, y: number, z: number];

type SnapshotCamera = {
    position?: SnapshotVector3;
    target?: SnapshotVector3;
    zoom?: number;
};

type SnapshotLighting = {
    ambientIntensity?: number;
    fillIntensity?: number;
    fillPosition?: SnapshotVector3;
    hemisphereGroundColor?: string;
    hemisphereIntensity?: number;
    hemisphereSkyColor?: string;
    keyColor?: string;
    keyIntensity?: number;
    keyPosition?: SnapshotVector3;
    shadowCameraSize?: number;
    shadowIntensity?: number;
    shadowMapSize?: number;
    shadowNormalBias?: number;
    shadowRadius?: number;
    shadows?: boolean;
};

type SnapshotAsset = {
    assetName: GameAssetName;
    position?: SnapshotVector3;
    rotation?: SnapshotVector3;
    scale?: number | SnapshotVector3;
    castShadow?: boolean;
    receiveShadow?: boolean;
};

export type GameAssetSnapshotRecipe = {
    camera?: SnapshotCamera;
    asset: SnapshotAsset;
    lighting?: SnapshotLighting;
    showBackground?: boolean;
};

const defaultDeviceScaleFactor = 4;
const defaultCamera = {
    position: [0.5, 0.62, 7],
    target: [0.5, 0.62, 0.5],
    zoom: 118,
} satisfies Required<SnapshotCamera>;
const defaultSnapshotLighting = {
    ambientIntensity: 1.25,
    fillIntensity: 0.75,
    fillPosition: [-2.8, 2.6, -3.2],
    hemisphereGroundColor: '#d7c5a6',
    hemisphereIntensity: 1.15,
    hemisphereSkyColor: '#f4fff3',
    keyColor: '#fff6e5',
    keyIntensity: 3.2,
    keyPosition: [2.6, 4.8, 5.8],
    shadowCameraSize: 1.8,
    shadowIntensity: 0.34,
    shadowMapSize: 2048,
    shadowNormalBias: 0.012,
    shadowRadius: 1.5,
    shadows: true,
} satisfies Required<SnapshotLighting>;

function toVector3(
    value: SnapshotVector3 | undefined,
    fallback: SnapshotVector3,
): MutableVector3 {
    const vector = value ?? fallback;
    return [vector[0], vector[1], vector[2]];
}

function normalizeSnapshotScale(
    scale: number | SnapshotVector3 | undefined,
): MutableVector3 {
    if (typeof scale === 'number' || scale === undefined) {
        const scalar = scale ?? 1;
        return [scalar, scalar, scalar];
    }

    return [scale[0], scale[1], scale[2]];
}

function CameraLookAt({ target }: { target: SnapshotVector3 }) {
    const camera = useThree((state) => state.camera);

    useEffect(() => {
        camera.lookAt(target[0], target[1], target[2]);
        camera.updateProjectionMatrix();
    }, [camera, target]);

    return null;
}

function SnapshotLightingSetup({
    lighting,
}: {
    lighting: SnapshotLighting | undefined;
}) {
    const resolvedLighting = {
        ...defaultSnapshotLighting,
        ...lighting,
    };

    return (
        <>
            <ambientLight intensity={resolvedLighting.ambientIntensity} />
            <hemisphereLight
                position={[0, 1, 0]}
                color={resolvedLighting.hemisphereSkyColor}
                groundColor={resolvedLighting.hemisphereGroundColor}
                intensity={resolvedLighting.hemisphereIntensity}
            />
            <directionalLight
                position={toVector3(
                    resolvedLighting.keyPosition,
                    defaultSnapshotLighting.keyPosition,
                )}
                color={resolvedLighting.keyColor}
                intensity={resolvedLighting.keyIntensity}
                shadow-intensity={resolvedLighting.shadowIntensity}
                shadow-mapSize-width={resolvedLighting.shadowMapSize}
                shadow-mapSize-height={resolvedLighting.shadowMapSize}
                shadow-radius={resolvedLighting.shadowRadius}
                shadow-normalBias={resolvedLighting.shadowNormalBias}
                castShadow={resolvedLighting.shadows}
            >
                <orthographicCamera
                    attach="shadow-camera"
                    args={[
                        -resolvedLighting.shadowCameraSize,
                        resolvedLighting.shadowCameraSize,
                        resolvedLighting.shadowCameraSize,
                        -resolvedLighting.shadowCameraSize,
                        0.1,
                        20,
                    ]}
                />
            </directionalLight>
            <directionalLight
                position={toVector3(
                    resolvedLighting.fillPosition,
                    defaultSnapshotLighting.fillPosition,
                )}
                intensity={resolvedLighting.fillIntensity}
            />
        </>
    );
}

function SnapshotAssetModel({ asset }: { asset: SnapshotAsset }) {
    const gltf = useGameGLTF(asset.assetName);
    const scene = useMemo(() => {
        const clone = gltf.scene.clone(true);
        clone.traverse((node) => {
            if ('isMesh' in node) {
                if (asset.castShadow !== undefined) {
                    node.castShadow = asset.castShadow;
                }
                if (asset.receiveShadow !== undefined) {
                    node.receiveShadow = asset.receiveShadow;
                }
            }
        });
        return clone;
    }, [asset.castShadow, asset.receiveShadow, gltf.scene]);
    const scale = normalizeSnapshotScale(asset.scale);

    return (
        <group
            position={toVector3(asset.position, [0, 0, 0])}
            rotation={toVector3(asset.rotation, [0, 0, 0])}
            scale={scale}
        >
            <primitive object={scene} dispose={null} />
        </group>
    );
}

export type GameAssetSnapshotViewerProps = HTMLAttributes<HTMLDivElement> & {
    appBaseUrl?: string;
    recipe: GameAssetSnapshotRecipe;
    deviceScaleFactor?: number;
};

export function GameAssetSnapshotViewer({
    appBaseUrl,
    recipe,
    deviceScaleFactor = defaultDeviceScaleFactor,
    ...rest
}: GameAssetSnapshotViewerProps) {
    const storeRef = useRef<GameStateStore>(null);
    if (!storeRef.current) {
        storeRef.current = createGameState({
            appBaseUrl: appBaseUrl || '',
            dayNightCycleDisabled: false,
            freezeTime: new Date(2024, 5, 21, 12, 0, 0),
            isMock: true,
            winterMode: 'summer',
        });
    }
    useDisposeGameStateStore(storeRef.current);

    const queryClient = useMemo(() => new QueryClient(), []);
    const camera = {
        ...defaultCamera,
        ...recipe.camera,
    };
    const cameraPosition = toVector3(camera.position, defaultCamera.position);
    const cameraTarget = toVector3(camera.target, defaultCamera.target);
    const lighting = recipe.lighting
        ? {
              ...defaultSnapshotLighting,
              ...recipe.lighting,
          }
        : null;
    const snapshotQuality = {
        ...gameQualityProfiles.low,
        dpr: deviceScaleFactor,
        shadowMapSize:
            lighting?.shadowMapSize ?? gameQualityProfiles.low.shadowMapSize,
        shadows: lighting?.shadows ?? gameQualityProfiles.low.shadows,
    };

    return (
        <QueryClientProvider client={queryClient}>
            <GameStateContext.Provider value={storeRef.current}>
                <GameFlagsContext.Provider
                    value={{
                        enableDebugHudFlag: false,
                    }}
                >
                    <GameSceneDetailContext.Provider
                        value={{
                            includePendingCartPlants: false,
                            renderDetails: false,
                        }}
                    >
                        <Scene
                            position={cameraPosition}
                            zoom={camera.zoom}
                            quality={snapshotQuality}
                            {...rest}
                        >
                            <ParticleSystemProvider>
                                {lighting ? (
                                    <SnapshotLightingSetup
                                        lighting={lighting}
                                    />
                                ) : (
                                    <StaticEnvironment
                                        noBackground={!recipe.showBackground}
                                    />
                                )}
                                <CameraLookAt target={cameraTarget} />
                                <SnapshotAssetModel asset={recipe.asset} />
                            </ParticleSystemProvider>
                        </Scene>
                    </GameSceneDetailContext.Provider>
                </GameFlagsContext.Provider>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
