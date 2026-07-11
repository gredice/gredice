'use client';

import { calculatePlantsPerField } from '@gredice/js/plants';
import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useGameSceneDetails } from '../../GameSceneDetailContext';
import { getApproximatePlantHeight } from '../../generators/plant/lib/buildPlantRenderData';
import {
    calculateInGamePlantGeneration,
    getPlantLifecycleWindowDays,
    type ResolvedInGamePlantPreset,
    resolveInGamePlantPreset,
} from '../../generators/plant/lib/inGamePlantPresets';
import {
    type PlantLodLevel,
    resolvePlantLodLevelWithHysteresis,
} from '../../generators/plant/lib/plantLod';
import {
    useCurrentGarden,
    useIsSandboxGarden,
} from '../../hooks/useCurrentGarden';
import { useAllSorts } from '../../hooks/usePlantSorts';
import { useShoppingCart } from '../../hooks/useShoppingCart';
import { useSnapshotTime } from '../../hooks/useSnapshotTime';
import { useGameState } from '../../useGameState';
import {
    findRaisedBedByBlockId,
    getRaisedBedBlockIds,
} from '../../utils/raisedBedBlocks';
import { isRaisedBedFieldOccupied } from '../../utils/raisedBedFields';
import {
    getGridPositionFromIndex,
    type RaisedBedOrientation,
} from '../../utils/raisedBedOrientation';
import {
    RaisedBedGeneratedPlantBatch,
    type RaisedBedGeneratedPlantBatchInstance,
} from './RaisedBedGeneratedPlantBatch';
import { mockPlantPresetLabelsBySortId } from './RaisedBedPlantField';

export interface RaisedBedGeneratedPlantFieldBatchBlock {
    blockId: string;
    position: readonly [number, number, number];
}

type DisplayedRaisedBedField = {
    id?: number | string;
    positionIndex: number;
    plantSortId: number | null | undefined;
    plantStatus?: string | null;
    plantSowDate?: string | null;
};

type GeneratedPlantField = {
    approximatePlantHeight: number;
    definition: ResolvedInGamePlantPreset['definition'];
    fieldKey: string;
    instances: RaisedBedGeneratedPlantBatchInstance[];
    plantType: ResolvedInGamePlantPreset['plantType'];
    position: readonly [number, number, number];
};

type GeneratedPlantBatch = {
    definition: ResolvedInGamePlantPreset['definition'];
    instances: RaisedBedGeneratedPlantBatchInstance[];
    lodLevel: PlantLodLevel;
    plantType: ResolvedInGamePlantPreset['plantType'];
};

const seedLayoutByPlantsPerRow = [
    { multiplier: 0, offset: 0 },
    { multiplier: 0, offset: 0 },
    { multiplier: 0.13, offset: 0.03 },
    { multiplier: 0.09, offset: 0.025 },
    { multiplier: 0.07, offset: 0.0225 },
];

const FIELD_VISIBILITY_MARGIN = 0.24;

function getFieldRenderKey(blockId: string, field: DisplayedRaisedBedField) {
    return `${blockId}:${field.id ?? 'field'}:${field.positionIndex}:${field.plantSortId ?? 'sort'}`;
}

function shouldRenderGeneratedPlantField(field: DisplayedRaisedBedField) {
    return (
        Boolean(field.plantSowDate) &&
        (field.plantStatus === 'sprouted' ||
            field.plantStatus === 'ready' ||
            field.plantStatus === 'harvested')
    );
}

function getFieldPosition({
    blockIndex,
    blockPosition,
    orientation,
    positionIndex,
}: {
    blockIndex: number;
    blockPosition: readonly [number, number, number];
    orientation: RaisedBedOrientation;
    positionIndex: number;
}) {
    const offsetX =
        orientation === 'vertical' ? 0.31 - blockIndex * 0.05 : 0.27;
    const offsetY =
        orientation === 'vertical' ? 0.27 : 0.27 + blockIndex * 0.05;
    const multiplierX = orientation === 'vertical' ? 0.285 : 0.27;
    const multiplierY = orientation === 'vertical' ? 0.27 : 0.285;
    const { row, col } = getGridPositionFromIndex(positionIndex, orientation);

    return [
        blockPosition[0] + col * multiplierX - offsetX,
        blockPosition[1] - 0.75,
        blockPosition[2] + (2 - row) * multiplierY - offsetY,
    ] as const;
}

function getOrthographicCameraZoom(camera: THREE.Camera) {
    return camera instanceof THREE.OrthographicCamera ? camera.zoom : 0;
}

function resolveGeneratedFieldVisibility({
    approximatePlantHeight,
    camera,
    viewportHeight,
    worldPosition,
}: {
    approximatePlantHeight: number;
    camera: THREE.Camera;
    viewportHeight: number;
    worldPosition: THREE.Vector3;
}) {
    const projected = worldPosition.clone().project(camera);
    if (
        !Number.isFinite(projected.x) ||
        !Number.isFinite(projected.y) ||
        !Number.isFinite(projected.z)
    ) {
        return true;
    }

    const plantMargin = Math.max(approximatePlantHeight, 0.25) / viewportHeight;
    const ndcMargin = FIELD_VISIBILITY_MARGIN + plantMargin * 2;

    return (
        Math.abs(projected.x) <= 1 + ndcMargin &&
        Math.abs(projected.y) <= 1 + ndcMargin
    );
}

function useGeneratedPlantFieldLods(generatedFields: GeneratedPlantField[]) {
    const camera = useThree((state) => state.camera);
    const viewport = useThree((state) => state.viewport);
    const gameCamera = useGameState((state) => state.gameCamera);
    const worldPosition = useMemo(() => new THREE.Vector3(), []);
    const [lodByFieldKey, setLodByFieldKey] = useState(
        () => new Map<string, { level: PlantLodLevel; visible: boolean }>(),
    );
    const lodByFieldKeyRef = useRef(lodByFieldKey);

    useLayoutEffect(() => {
        lodByFieldKeyRef.current = lodByFieldKey;
    }, [lodByFieldKey]);

    const updateLods = useCallback(() => {
        if (generatedFields.length === 0) {
            setLodByFieldKey((current) =>
                current.size === 0 ? current : new Map(),
            );
            return;
        }

        const next = new Map<
            string,
            { level: PlantLodLevel; visible: boolean }
        >();

        for (const field of generatedFields) {
            worldPosition.set(...field.position);
            const currentViewport = viewport.getCurrentViewport(
                camera,
                worldPosition,
            );
            const viewportHeight = Math.max(currentViewport.height, 0.001);
            const screenOccupancy =
                Math.max(field.approximatePlantHeight, 0.25) / viewportHeight;
            const visible = resolveGeneratedFieldVisibility({
                approximatePlantHeight: field.approximatePlantHeight,
                camera,
                viewportHeight,
                worldPosition,
            });
            const previousLevel =
                lodByFieldKeyRef.current.get(field.fieldKey)?.level ?? 'far';
            const level = resolvePlantLodLevelWithHysteresis({
                cameraZoom: getOrthographicCameraZoom(camera),
                currentLevel: previousLevel,
                screenOccupancy,
            });

            next.set(field.fieldKey, {
                level: visible ? level : 'far',
                visible,
            });
        }

        setLodByFieldKey((current) => {
            if (current.size !== next.size) {
                return next;
            }

            for (const [key, nextState] of next) {
                const currentState = current.get(key);
                if (
                    !currentState ||
                    currentState.level !== nextState.level ||
                    currentState.visible !== nextState.visible
                ) {
                    return next;
                }
            }

            return current;
        });
    }, [camera, generatedFields, viewport, worldPosition]);

    useLayoutEffect(() => {
        updateLods();

        if (!gameCamera) {
            return;
        }

        return gameCamera.subscribe(() => updateLods());
    }, [gameCamera, updateLods]);

    useFrame(() => {
        if (gameCamera) {
            return;
        }

        updateLods();
    });

    return lodByFieldKey;
}

export function RaisedBedGeneratedPlantFieldBatches({
    blocks,
}: {
    blocks: RaisedBedGeneratedPlantFieldBatchBlock[];
}) {
    const { includePendingCartPlants, renderDetails } = useGameSceneDetails();
    const { data: currentGarden } = useCurrentGarden();
    const { data: sortData } = useAllSorts();
    const isMock = useGameState((state) => state.isMock);
    const isSandbox = useIsSandboxGarden();
    const isLocalSandbox = useGameState(
        (state) => state.localSandboxStorageKey !== null,
    );
    const currentTime = useSnapshotTime();
    const { data: cart } = useShoppingCart(
        includePendingCartPlants && renderDetails && !isLocalSandbox,
    );
    const generatedFields = useMemo(() => {
        const fields: GeneratedPlantField[] = [];

        if (!renderDetails || !currentGarden) {
            return fields;
        }

        for (const block of blocks) {
            const raisedBed = findRaisedBedByBlockId(
                currentGarden,
                block.blockId,
            );
            if (!raisedBed) {
                continue;
            }

            const orientation = raisedBed.orientation ?? 'vertical';
            const blockIds = getRaisedBedBlockIds(currentGarden, raisedBed.id);
            const blockIndex = blockIds.indexOf(block.blockId);
            const blockOffset =
                Math.max(blockIds.length - 1 - blockIndex, 0) * 9;
            const cartItems = cart?.items.filter(
                (item) =>
                    item.gardenId === currentGarden.id &&
                    item.raisedBedId === raisedBed.id &&
                    item.entityTypeName === 'plantSort' &&
                    typeof item.positionIndex === 'number' &&
                    item.positionIndex >= blockOffset &&
                    item.positionIndex < blockOffset + 9,
            );
            const displayedFields: DisplayedRaisedBedField[] = [
                ...(raisedBed.fields
                    ?.filter(
                        (field) =>
                            isRaisedBedFieldOccupied(field) &&
                            field.positionIndex >= blockOffset &&
                            field.positionIndex < blockOffset + 9,
                    )
                    .map((field) => ({
                        id: field.id,
                        plantSortId: field.plantSortId,
                        plantStatus: field.plantStatus,
                        plantSowDate: field.plantSowDate,
                        positionIndex: field.positionIndex,
                    })) ?? []),
                ...(cartItems?.flatMap((item) => {
                    if (item.positionIndex === null) {
                        return [];
                    }

                    return [
                        {
                            id: `cart-item-${item.id}`,
                            plantSortId: Number(item.entityId),
                            positionIndex: item.positionIndex,
                        },
                    ];
                }) ?? []),
            ];

            for (const field of displayedFields) {
                const plantSortId = field.plantSortId;
                const sort = sortData?.find((item) => item.id === plantSortId);
                const resolvedPlantPreset = resolveInGamePlantPreset([
                    sort?.information.name,
                    sort?.information.plant.information?.name,
                    sort?.information.plant.information?.latinName,
                    isMock || isSandbox
                        ? mockPlantPresetLabelsBySortId[plantSortId ?? 0]
                        : undefined,
                ]);

                if (
                    !plantSortId ||
                    !resolvedPlantPreset ||
                    !shouldRenderGeneratedPlantField(field)
                ) {
                    continue;
                }

                const { plantsPerRow, totalPlants } = calculatePlantsPerField(
                    sort?.information.plant.attributes?.seedingDistance,
                );
                const safePlantsPerRow = Math.max(plantsPerRow, 1);
                const seedLayout =
                    seedLayoutByPlantsPerRow[safePlantsPerRow] ??
                    seedLayoutByPlantsPerRow[
                        seedLayoutByPlantsPerRow.length - 1
                    ];
                const plantGeneration = calculateInGamePlantGeneration({
                    currentTime,
                    sowDate: field.plantSowDate ?? '',
                    lifecycleWindowDays: getPlantLifecycleWindowDays({
                        germinationWindowMax:
                            sort?.information.plant.attributes
                                ?.germinationWindowMax,
                        growthWindowMax:
                            sort?.information.plant.attributes?.growthWindowMax,
                        harvestWindowMax:
                            sort?.information.plant.attributes
                                ?.harvestWindowMax,
                    }),
                    growthMultiplier: resolvedPlantPreset.growthMultiplier,
                });
                const plantInstanceScale =
                    resolvedPlantPreset.instanceScale *
                    Math.max(
                        0.72,
                        1 - Math.max(0, safePlantsPerRow - 2) * 0.12,
                    );
                const fieldPosition = getFieldPosition({
                    blockIndex,
                    blockPosition: block.position,
                    orientation,
                    positionIndex: field.positionIndex - blockOffset,
                });
                const approximatePlantHeight =
                    getApproximatePlantHeight(
                        resolvedPlantPreset.definition,
                        plantGeneration,
                    ) * plantInstanceScale;
                const instances: RaisedBedGeneratedPlantBatchInstance[] = [];

                for (let index = 0; index < totalPlants; index += 1) {
                    const slotX =
                        Math.floor(index / safePlantsPerRow) *
                            seedLayout.multiplier -
                        safePlantsPerRow * seedLayout.offset;
                    const slotZ =
                        (index % safePlantsPerRow) * seedLayout.multiplier -
                        safePlantsPerRow * seedLayout.offset;

                    instances.push({
                        generation: plantGeneration,
                        position: [
                            fieldPosition[0] + slotX,
                            fieldPosition[1] + 0.02,
                            fieldPosition[2] + slotZ,
                        ],
                        scale: plantInstanceScale,
                        seed: `${block.blockId}:${plantSortId}:${field.positionIndex}:${index}`,
                    });
                }

                fields.push({
                    approximatePlantHeight,
                    definition: resolvedPlantPreset.definition,
                    fieldKey: getFieldRenderKey(block.blockId, field),
                    instances,
                    plantType: resolvedPlantPreset.plantType,
                    position: fieldPosition,
                });
            }
        }

        return fields;
    }, [
        blocks,
        cart?.items,
        currentGarden,
        currentTime,
        isMock,
        isSandbox,
        renderDetails,
        sortData,
    ]);
    const lods = useGeneratedPlantFieldLods(generatedFields);
    const batches = useMemo(() => {
        const batchMap = new Map<string, GeneratedPlantBatch>();

        for (const field of generatedFields) {
            const lod = lods.get(field.fieldKey);
            if (!lod?.visible) {
                continue;
            }

            const batchKey = `${field.plantType}:${lod.level}`;
            let batch = batchMap.get(batchKey);

            if (!batch) {
                batch = {
                    definition: field.definition,
                    instances: [],
                    lodLevel: lod.level,
                    plantType: field.plantType,
                };
                batchMap.set(batchKey, batch);
            }

            batch.instances.push(...field.instances);
        }

        return Array.from(batchMap.values());
    }, [generatedFields, lods]);

    if (!renderDetails || batches.length === 0) {
        return null;
    }

    return (
        <group
            name={`RaisedBedGeneratedPlantFieldBatches:batches:${batches.length}`}
        >
            {batches.map((batch) => (
                <RaisedBedGeneratedPlantBatch
                    key={`${batch.plantType}:${batch.lodLevel}`}
                    definition={batch.definition}
                    instances={batch.instances}
                    lodLevel={batch.lodLevel}
                />
            ))}
        </group>
    );
}
