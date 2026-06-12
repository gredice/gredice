'use client';

import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type HTMLAttributes, useEffect, useMemo, useRef } from 'react';
import { MOUSE, type Object3D, Vector3 } from 'three';
import { v4 as uuidv4 } from 'uuid';
import type { GameAssetName } from '../data/models';
import { EntityFactory } from '../entities/EntityFactory';
import type { EntityName } from '../entities/entityNameMap';
import { GameFlagsContext } from '../GameFlagsContext';
import { GameSceneDetailContext } from '../GameSceneDetailContext';
import { useGeneratedLSystemSymbols } from '../generators/plant/hooks/useGeneratedLSystem';
import { MAX_PLANT_GENERATION } from '../generators/plant/lib/plant-definition-types';
import { plantTypes } from '../generators/plant/lib/plant-presets';
import { PlantGenerator } from '../generators/plant/PlantGenerator';
import { ParticleSystemProvider } from '../particles/ParticleSystem';
import { StaticEnvironment } from '../scene/Environment';
import { gameQualityProfiles } from '../scene/gameQuality';
import { Scene } from '../scene/Scene';
import type { Block } from '../types/Block';
import {
    createGameState,
    GameStateContext,
    type GameStateStore,
    useDisposeGameStateStore,
} from '../useGameState';
import { useGameGLTF } from '../utils/useGameGLTF';

export type OperationCoverVector3 = readonly [x: number, y: number, z: number];

type MutableVector3 = [x: number, y: number, z: number];

export type OperationCoverCamera = {
    position?: OperationCoverVector3;
    target?: OperationCoverVector3;
    zoom?: number;
};

export type OperationCoverAsset = {
    id?: string;
    assetName: GameAssetName;
    position?: OperationCoverVector3;
    rotation?: OperationCoverVector3;
    scale?: number | OperationCoverVector3;
    visibleNodeNames?: readonly string[];
    hiddenNodeNames?: readonly string[];
};

export type OperationCoverEntity = {
    id?: string;
    entityName: EntityName;
    position?: OperationCoverVector3;
    rotation?: number;
    variant?: number;
};

export type OperationCoverPlant = {
    id?: string;
    plantType: keyof typeof plantTypes;
    generation?: number;
    seed?: string;
    position?: OperationCoverVector3;
    rotation?: OperationCoverVector3;
    scale?: number | OperationCoverVector3;
    showFlowers?: boolean;
    showProduce?: boolean;
};

export type OperationCoverAgrotextileCover = {
    id?: string;
    position?: OperationCoverVector3;
    rotation?: OperationCoverVector3;
    scale?: number | OperationCoverVector3;
    width?: number;
    depth?: number;
    opacity?: number;
};

export type OperationCoverRecipe = {
    operationId: string;
    operationLabel: string;
    outputFileName: `${string}.webp`;
    camera?: OperationCoverCamera;
    assets?: readonly OperationCoverAsset[];
    entities?: readonly OperationCoverEntity[];
    plants?: readonly OperationCoverPlant[];
    agrotextileCovers?: readonly OperationCoverAgrotextileCover[];
    showBackground?: boolean;
};

const defaultDeviceScaleFactor = 4;
const defaultCamera = {
    position: [0.5, 0.62, 7],
    target: [0.5, 0.62, 0.5],
    zoom: 118,
} satisfies Required<OperationCoverCamera>;

function toVector3(
    value: OperationCoverVector3 | undefined,
    fallback: OperationCoverVector3,
): MutableVector3 {
    const vector = value ?? fallback;
    return [vector[0], vector[1], vector[2]];
}

export function normalizeOperationCoverScale(
    scale: number | OperationCoverVector3 | undefined,
): MutableVector3 {
    if (typeof scale === 'number' || scale === undefined) {
        const scalar = scale ?? 1;
        return [scalar, scalar, scalar];
    }

    return [scale[0], scale[1], scale[2]];
}

function CameraLookAt({ target }: { target: OperationCoverVector3 }) {
    const camera = useThree((state) => state.camera);

    useEffect(() => {
        camera.lookAt(target[0], target[1], target[2]);
        camera.updateProjectionMatrix();
    }, [camera, target]);

    return null;
}

function updateNodeVisibility({
    root,
    visibleNodeNames,
    hiddenNodeNames,
}: {
    root: Object3D;
    visibleNodeNames?: readonly string[];
    hiddenNodeNames?: readonly string[];
}) {
    const visible = visibleNodeNames ? new Set(visibleNodeNames) : null;
    const hidden = hiddenNodeNames ? new Set(hiddenNodeNames) : null;

    root.traverse((node) => {
        if (!('isMesh' in node)) {
            return;
        }

        if (visible) {
            node.visible = visible.has(node.name);
        }

        if (hidden?.has(node.name)) {
            node.visible = false;
        }
    });
}

function getAssetKey(recipe: OperationCoverRecipe, asset: OperationCoverAsset) {
    return [
        recipe.operationId,
        'asset',
        asset.id,
        asset.assetName,
        asset.position?.join(','),
        asset.rotation?.join(','),
        Array.isArray(asset.scale) ? asset.scale.join(',') : asset.scale,
        asset.visibleNodeNames?.join(','),
        asset.hiddenNodeNames?.join(','),
    ].join(':');
}

function getEntityKey(
    recipe: OperationCoverRecipe,
    entity: OperationCoverEntity,
) {
    return [
        recipe.operationId,
        'entity',
        entity.id,
        entity.entityName,
        entity.position?.join(','),
        entity.rotation,
        entity.variant,
    ].join(':');
}

function getPlantKey(recipe: OperationCoverRecipe, plant: OperationCoverPlant) {
    return [
        recipe.operationId,
        'plant',
        plant.id,
        plant.plantType,
        plant.seed,
        plant.generation,
        plant.position?.join(','),
        plant.rotation?.join(','),
        Array.isArray(plant.scale) ? plant.scale.join(',') : plant.scale,
        plant.showFlowers,
        plant.showProduce,
    ].join(':');
}

function getAgrotextileCoverKey(
    recipe: OperationCoverRecipe,
    cover: OperationCoverAgrotextileCover,
) {
    return [
        recipe.operationId,
        'agrotextile-cover',
        cover.id,
        cover.position?.join(','),
        cover.rotation?.join(','),
        Array.isArray(cover.scale) ? cover.scale.join(',') : cover.scale,
        cover.width,
        cover.depth,
        cover.opacity,
    ].join(':');
}

function OperationCoverEntityModel({
    entity,
}: {
    entity: OperationCoverEntity;
}) {
    const normalizedRotation = (((entity.rotation ?? 0) % 4) + 4) % 4;
    const block = useMemo<Block>(
        () => ({
            id: entity.id ?? uuidv4(),
            name: entity.entityName,
            rotation: normalizedRotation,
            variant: entity.variant,
        }),
        [entity.entityName, entity.id, entity.variant, normalizedRotation],
    );
    const stack = useMemo(
        () => ({
            position: new Vector3(...toVector3(entity.position, [0.5, 0, 0.5])),
            blocks: [block],
        }),
        [block, entity.position],
    );

    return (
        <EntityFactory
            name={entity.entityName}
            stack={stack}
            block={block}
            noControl
            rotation={normalizedRotation}
            variant={entity.variant}
        />
    );
}

function OperationCoverAssetModel({ asset }: { asset: OperationCoverAsset }) {
    const gltf = useGameGLTF(asset.assetName);
    const scene = useMemo(() => {
        const clone = gltf.scene.clone(true);
        updateNodeVisibility({
            root: clone,
            visibleNodeNames: asset.visibleNodeNames,
            hiddenNodeNames: asset.hiddenNodeNames,
        });
        return clone;
    }, [asset.hiddenNodeNames, asset.visibleNodeNames, gltf.scene]);
    const scale = normalizeOperationCoverScale(asset.scale);

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

function OperationCoverPlantModel({ plant }: { plant: OperationCoverPlant }) {
    const definition = plantTypes[plant.plantType];
    const generation = plant.generation ?? MAX_PLANT_GENERATION * 0.75;
    const seed = plant.seed ?? `operation-cover-${plant.plantType}`;
    const scale = normalizeOperationCoverScale(plant.scale);
    const lSystemTask = useMemo(
        () => ({
            axiom: definition.axiom,
            iterations: Math.ceil(generation),
            rules: definition.rules,
            seed,
        }),
        [definition.axiom, definition.rules, generation, seed],
    );
    const { symbols: lSystemSymbols } = useGeneratedLSystemSymbols(
        lSystemTask,
        {
            syncInitialResult: true,
        },
    );

    return (
        <group
            position={toVector3(plant.position, [0, 0, 0])}
            rotation={toVector3(plant.rotation, [0, 0, 0])}
            scale={scale}
        >
            <PlantGenerator
                key={`${plant.plantType}-${seed}`}
                plantDefinition={definition}
                lSystemSymbols={lSystemSymbols ?? []}
                generation={generation}
                seed={seed}
                flowerGrowth={plant.showFlowers === false ? 0 : 1}
                fruitGrowth={plant.showProduce === false ? 0 : 1}
                animate={false}
                showLeaves
                showFlowers={plant.showFlowers ?? true}
                showProduce={plant.showProduce ?? true}
            />
        </group>
    );
}

function OperationCoverAgrotextileCoverModel({
    cover,
}: {
    cover: OperationCoverAgrotextileCover;
}) {
    const scale = normalizeOperationCoverScale(cover.scale);
    const width = cover.width ?? 0.7;
    const depth = cover.depth ?? 0.46;
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    const hemThickness = 0.018;

    return (
        <group
            position={toVector3(cover.position, [0, 0, 0])}
            rotation={toVector3(cover.rotation, [0, 0, 0])}
            scale={scale}
        >
            <mesh
                position={[0, 0.004, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                renderOrder={4}
            >
                <planeGeometry args={[width, depth]} />
                <meshStandardMaterial
                    color="#dcd7c6"
                    depthWrite={false}
                    opacity={cover.opacity ?? 0.76}
                    polygonOffset
                    polygonOffsetFactor={-4}
                    roughness={1}
                    transparent
                />
            </mesh>
            <mesh position={[0, 0.012, -halfDepth]} renderOrder={5}>
                <boxGeometry args={[width + hemThickness, 0.008, hemThickness]} />
                <meshStandardMaterial color="#eee9d8" roughness={1} />
            </mesh>
            <mesh position={[0, 0.012, halfDepth]} renderOrder={5}>
                <boxGeometry args={[width + hemThickness, 0.008, hemThickness]} />
                <meshStandardMaterial color="#eee9d8" roughness={1} />
            </mesh>
            <mesh position={[-halfWidth, 0.012, 0]} renderOrder={5}>
                <boxGeometry
                    args={[hemThickness, 0.008, depth + hemThickness]}
                />
                <meshStandardMaterial color="#eee9d8" roughness={1} />
            </mesh>
            <mesh position={[halfWidth, 0.012, 0]} renderOrder={5}>
                <boxGeometry
                    args={[hemThickness, 0.008, depth + hemThickness]}
                />
                <meshStandardMaterial color="#eee9d8" roughness={1} />
            </mesh>
        </group>
    );
}

export type OperationCoverSnapshotViewerProps =
    HTMLAttributes<HTMLDivElement> & {
        appBaseUrl?: string;
        recipe: OperationCoverRecipe;
        noControl?: boolean;
        deviceScaleFactor?: number;
    };

export function OperationCoverSnapshotViewer({
    appBaseUrl,
    recipe,
    noControl = true,
    deviceScaleFactor = defaultDeviceScaleFactor,
    ...rest
}: OperationCoverSnapshotViewerProps) {
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
    const snapshotQuality = {
        ...gameQualityProfiles.low,
        dpr: deviceScaleFactor,
    };

    return (
        <QueryClientProvider client={queryClient}>
            <GameStateContext.Provider value={storeRef.current}>
                <GameFlagsContext.Provider
                    value={{
                        enableDebugHudFlag: false,
                        enableRainWetOverlayFlag: false,
                    }}
                >
                    <GameSceneDetailContext.Provider
                        value={{ renderDetails: false }}
                    >
                        <Scene
                            position={cameraPosition}
                            zoom={camera.zoom}
                            quality={snapshotQuality}
                            {...rest}
                        >
                            <ParticleSystemProvider>
                                <StaticEnvironment
                                    noBackground={!recipe.showBackground}
                                />
                                <CameraLookAt target={cameraTarget} />
                                {recipe.entities?.map((entity) => (
                                    <OperationCoverEntityModel
                                        key={getEntityKey(recipe, entity)}
                                        entity={entity}
                                    />
                                ))}
                                {recipe.assets?.map((asset) => (
                                    <OperationCoverAssetModel
                                        key={getAssetKey(recipe, asset)}
                                        asset={asset}
                                    />
                                ))}
                                {recipe.plants?.map((plant) => (
                                    <OperationCoverPlantModel
                                        key={getPlantKey(recipe, plant)}
                                        plant={plant}
                                    />
                                ))}
                                {recipe.agrotextileCovers?.map((cover) => (
                                    <OperationCoverAgrotextileCoverModel
                                        key={getAgrotextileCoverKey(
                                            recipe,
                                            cover,
                                        )}
                                        cover={cover}
                                    />
                                ))}
                                {!noControl && (
                                    <OrbitControls
                                        enableDamping
                                        screenSpacePanning={false}
                                        minZoom={20}
                                        maxZoom={220}
                                        target={cameraTarget}
                                        mouseButtons={{
                                            LEFT: MOUSE.PAN,
                                            MIDDLE: MOUSE.DOLLY,
                                            RIGHT: MOUSE.ROTATE,
                                        }}
                                    />
                                )}
                            </ParticleSystemProvider>
                        </Scene>
                    </GameSceneDetailContext.Provider>
                </GameFlagsContext.Provider>
            </GameStateContext.Provider>
        </QueryClientProvider>
    );
}
