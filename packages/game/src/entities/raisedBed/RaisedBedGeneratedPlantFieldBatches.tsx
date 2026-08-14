'use client';

import { calculatePlantsPerField } from '@gredice/js/plants';
import { useFrame, useThree } from '@react-three/fiber';
import {
    memo,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import * as THREE from 'three';
import { useHoveredBlockStore } from '../../controls/useHoveredBlockStore';
import { useGameSceneDetails } from '../../GameSceneDetailContext';
import type { GeneratedPlantTaskPriority } from '../../generators/plant/hooks/generatedPlantTaskScheduler';
import {
    calculateInGamePlantGeneration,
    getInGamePlantDefinition,
    getInGamePlantInstanceScale,
    getPlantMaturityWindowDays,
    type ResolvedInGamePlantPreset,
    resolveInGamePlantPreset,
} from '../../generators/plant/lib/inGamePlantPresets';
import { resolvePlantLeafGeometryDetail } from '../../generators/plant/lib/plantLeafGeometry';
import type { PlantLodLevel } from '../../generators/plant/lib/plantLod';
import { getApproximatePlantHeight } from '../../generators/plant/lib/plantRenderData';
import {
    getHighTargetMockGardenPlantInstanceCount,
    getHighTargetOperationVisualFixtureCounts,
    highTargetMockPlantRenderAttributesBySortId,
    resolveHighTargetOperationVisualsEnabled,
} from '../../hooks/mockGardenProfileFixtures';
import {
    useCurrentGarden,
    useIsSandboxGarden,
} from '../../hooks/useCurrentGarden';
import { useOperations } from '../../hooks/useOperations';
import { useAllSorts } from '../../hooks/usePlantSorts';
import { useShoppingCart } from '../../hooks/useShoppingCart';
import { useSnapshotTime } from '../../hooks/useSnapshotTime';
import { buildAdvancedSowingGardenPlantingVisuals } from '../../hud/raisedBed/advancedSowingGardenVisuals';
import { resolveOperationVisualRewards } from '../../operationVisualRewards';
import { updateGameProfileMetadata } from '../../scene/gameProfileMetadata';
import type { GameQualityProfile } from '../../scene/gameQuality';
import {
    getGeneratedPlantProfileSessionId,
    recordGeneratedPlantProfileFields,
    recordGeneratedPlantProfileLodEvaluation,
} from '../../scene/generatedPlantProfileMetrics';
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
    buildAdvancedSowingPlantVisualLayout,
    getSelectedPlantingVisualGeneration,
} from './advancedSowingPlantVisualLayout';
import { reconcileGeneratedPlantBatches } from './generatedPlantBatchReconciliation';
import {
    allocateGeneratedPlantDetailBudget,
    type GeneratedPlantDetailBudgetStats,
    HIGH_GENERATED_PLANT_DETAIL_INSTANCE_BUDGET,
    isGeneratedPlantDetailBudgetActive,
    resolveLegacyGeneratedPlantDetailBudget,
} from './generatedPlantDetailBudget';
import {
    buildGeneratedPlantRaisedBedBounds,
    getGeneratedPlantBatchKey,
    HIGH_QUALITY_PLANT_NEAR_HYSTERESIS,
    HIGH_QUALITY_PLANT_NEAR_THRESHOLD,
    isGeneratedPlantRaisedBedGroupVisible,
    resolveGeneratedPlantFieldLod,
} from './generatedPlantFieldLod';
import {
    RaisedBedGeneratedPlantBatch,
    type RaisedBedGeneratedPlantBatchInstance,
} from './RaisedBedGeneratedPlantBatch';
import {
    RaisedBedGeneratedPlantClusterBatch,
    type RaisedBedGeneratedPlantClusterField,
} from './RaisedBedGeneratedPlantClusterBatch';
import { mockPlantPresetLabelsBySortId } from './RaisedBedPlantField';
import { resolveRaisedBedProtectiveCoverPositions } from './raisedBedAgrotextileRewards';
import { shouldRenderRaisedBedPlant } from './raisedBedPlantVisualStatus';
import { resolveRaisedBedSupportPositions } from './raisedBedSupportRewards';

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
    blockId: string;
    definition: ResolvedInGamePlantPreset['definition'];
    fieldKey: string;
    instances: RaisedBedGeneratedPlantBatchInstance[];
    position: readonly [number, number, number];
    raisedBedId: number;
    renderVariant: string;
};

type GeneratedPlantBatch = {
    batchKey: string;
    definition: ResolvedInGamePlantPreset['definition'];
    instances: RaisedBedGeneratedPlantBatchInstance[];
    lodLevel: 'near';
    signature: string;
    taskPriority: GeneratedPlantTaskPriority;
};

type GeneratedPlantClusterBatch = {
    batchKey: string;
    fields: RaisedBedGeneratedPlantClusterField[];
    lodLevel: Exclude<PlantLodLevel, 'near'>;
    signature: string;
};

type GeneratedPlantRaisedBedGroup = {
    bounds: THREE.Sphere;
    fields: GeneratedPlantField[];
    raisedBedId: number;
};

type GeneratedPlantFieldLodState = {
    level: PlantLodLevel;
    requestedLevel: PlantLodLevel;
    visible: boolean;
};

type GeneratedPlantFieldLodSnapshot = {
    detailBudget: GeneratedPlantDetailBudgetStats;
    lodByFieldKey: Map<string, GeneratedPlantFieldLodState>;
};

const MemoRaisedBedGeneratedPlantBatch = memo(RaisedBedGeneratedPlantBatch);
const MemoRaisedBedGeneratedPlantClusterBatch = memo(
    RaisedBedGeneratedPlantClusterBatch,
);

const seedLayoutByPlantsPerRow = [
    { multiplier: 0, offset: 0 },
    { multiplier: 0, offset: 0 },
    { multiplier: 0.13, offset: 0.03 },
    { multiplier: 0.09, offset: 0.025 },
    { multiplier: 0.07, offset: 0.0225 },
];

const FIELD_VISIBILITY_MARGIN = 0.24;
const PLANT_LOD_DETAIL_RANK = {
    far: 0,
    mid: 1,
    near: 2,
} satisfies Record<PlantLodLevel, number>;

function getMostDetailedPlantLod(first: PlantLodLevel, second: PlantLodLevel) {
    return PLANT_LOD_DETAIL_RANK[first] >= PLANT_LOD_DETAIL_RANK[second]
        ? first
        : second;
}

function areDetailBudgetStatsEqual(
    first: GeneratedPlantDetailBudgetStats,
    second: GeneratedPlantDetailBudgetStats,
) {
    return (
        first.admittedBedCount === second.admittedBedCount &&
        first.admittedInstanceCount === second.admittedInstanceCount &&
        first.demotedBedCount === second.demotedBedCount &&
        first.evictedBedCount === second.evictedBedCount &&
        first.instanceBudget === second.instanceBudget &&
        first.overflowInstanceCount === second.overflowInstanceCount &&
        first.promotedBedCount === second.promotedBedCount &&
        first.releasedBedCount === second.releasedBedCount &&
        first.requestedBedCount === second.requestedBedCount &&
        first.requestedInstanceCount === second.requestedInstanceCount &&
        first.retainedBedCount === second.retainedBedCount &&
        first.usedBudgetInstanceCount === second.usedBudgetInstanceCount
    );
}

function getFieldRenderKey(blockId: string, field: DisplayedRaisedBedField) {
    return `${blockId}:${field.id ?? 'field'}:${field.positionIndex}:${field.plantSortId ?? 'sort'}`;
}

function getGeneratedPlantInstanceSignature(
    instance: RaisedBedGeneratedPlantBatchInstance,
) {
    return [
        instance.seed,
        instance.generation,
        instance.scale,
        ...instance.position,
    ].join(':');
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

function readRaisedBedPlantings(value: unknown) {
    return typeof value === 'object' && value !== null
        ? Reflect.get(value, 'plantings')
        : null;
}

function getOrthographicCameraZoom(camera: THREE.Camera) {
    return camera instanceof THREE.OrthographicCamera ? camera.zoom : 0;
}

function resolveGeneratedFieldVisibility({
    approximatePlantHeight,
    camera,
    projectedPosition,
    viewportHeight,
    worldPosition,
}: {
    approximatePlantHeight: number;
    camera: THREE.Camera;
    projectedPosition: THREE.Vector3;
    viewportHeight: number;
    worldPosition: THREE.Vector3;
}) {
    projectedPosition.copy(worldPosition).project(camera);
    if (
        !Number.isFinite(projectedPosition.x) ||
        !Number.isFinite(projectedPosition.y) ||
        !Number.isFinite(projectedPosition.z)
    ) {
        return true;
    }

    const plantMargin = Math.max(approximatePlantHeight, 0.25) / viewportHeight;
    const ndcMargin = FIELD_VISIBILITY_MARGIN + plantMargin * 2;

    return (
        Math.abs(projectedPosition.x) <= 1 + ndcMargin &&
        Math.abs(projectedPosition.y) <= 1 + ndcMargin
    );
}

function useGeneratedPlantFieldLods({
    detailInstanceBudget,
    focusActive,
    generatedFields,
    interactingRaisedBedId,
    nearHysteresis,
    nearThreshold,
    selectedRaisedBedId,
}: {
    detailInstanceBudget: number;
    focusActive: boolean;
    generatedFields: GeneratedPlantField[];
    interactingRaisedBedId: number | null;
    nearHysteresis?: number;
    nearThreshold?: number;
    selectedRaisedBedId: number | null;
}) {
    const camera = useThree((state) => state.camera);
    const viewport = useThree((state) => state.viewport);
    const gameCamera = useGameState((state) => state.gameCamera);
    const worldPosition = useMemo(() => new THREE.Vector3(), []);
    const projectedPosition = useMemo(() => new THREE.Vector3(), []);
    const projectionViewMatrix = useMemo(() => new THREE.Matrix4(), []);
    const frustum = useMemo(() => new THREE.Frustum(), []);
    const raisedBedGroups = useMemo(() => {
        const groupedFields = new Map<number, GeneratedPlantField[]>();

        for (const field of generatedFields) {
            const fields = groupedFields.get(field.raisedBedId);
            if (fields) {
                fields.push(field);
            } else {
                groupedFields.set(field.raisedBedId, [field]);
            }
        }

        return Array.from(
            groupedFields,
            ([raisedBedId, fields]): GeneratedPlantRaisedBedGroup => ({
                bounds: buildGeneratedPlantRaisedBedBounds(fields),
                fields,
                raisedBedId,
            }),
        );
    }, [generatedFields]);
    const [lodSnapshot, setLodSnapshot] =
        useState<GeneratedPlantFieldLodSnapshot>(() => ({
            detailBudget: allocateGeneratedPlantDetailBudget([], {
                instanceBudget: detailInstanceBudget,
            }).stats,
            lodByFieldKey: new Map(),
        }));
    const lodByFieldKeyRef = useRef(lodSnapshot.lodByFieldKey);
    const admittedRaisedBedIdsRef = useRef(new Set<number>());

    useLayoutEffect(() => {
        lodByFieldKeyRef.current = lodSnapshot.lodByFieldKey;
    }, [lodSnapshot.lodByFieldKey]);

    const updateLods = useCallback(() => {
        if (generatedFields.length === 0) {
            const detailBudget = allocateGeneratedPlantDetailBudget([], {
                instanceBudget: detailInstanceBudget,
            }).stats;
            admittedRaisedBedIdsRef.current = new Set();
            setLodSnapshot((current) =>
                current.lodByFieldKey.size === 0 &&
                areDetailBudgetStatsEqual(current.detailBudget, detailBudget)
                    ? current
                    : {
                          detailBudget,
                          lodByFieldKey: new Map(),
                      },
            );
            return;
        }

        const profileSessionId = getGeneratedPlantProfileSessionId();
        const profileActive = profileSessionId !== null;
        const profileStartedAt = profileActive ? performance.now() : 0;
        const provisionalGroups: Array<{
            fieldStates: Array<{
                fieldKey: string;
                requestedLevel: PlantLodLevel;
                visible: boolean;
            }>;
            instanceCount: number;
            isInteracting: boolean;
            isSelected: boolean;
            projectedBenefit: number;
            raisedBedId: number;
            requestedLod: PlantLodLevel;
            wasAdmitted: boolean;
        }> = [];
        const nextLodByFieldKey = new Map<
            string,
            GeneratedPlantFieldLodState
        >();
        const viewportHeight = Math.max(
            viewport.getCurrentViewport(camera).height,
            0.001,
        );
        projectionViewMatrix.multiplyMatrices(
            camera.projectionMatrix,
            camera.matrixWorldInverse,
        );
        frustum.setFromProjectionMatrix(projectionViewMatrix);
        let evaluatedFieldCount = 0;
        let fieldProjectionTestCount = 0;
        let groupRejectionCount = 0;
        let groupTestCount = 0;

        for (const group of raisedBedGroups) {
            if (profileActive) {
                groupTestCount += 1;
            }
            const isSelectedRaisedBed =
                group.raisedBedId === selectedRaisedBedId;
            const groupVisible = isGeneratedPlantRaisedBedGroupVisible({
                bounds: group.bounds,
                focusActive,
                frustum,
                isSelectedRaisedBed,
            });

            if (!groupVisible) {
                if (profileActive) {
                    groupRejectionCount += 1;
                }
                const fieldStates = group.fields.map((field) => ({
                    fieldKey: field.fieldKey,
                    requestedLevel: 'far' as const,
                    visible: false,
                }));
                for (const field of group.fields) {
                    nextLodByFieldKey.set(field.fieldKey, {
                        level: 'far',
                        requestedLevel: 'far',
                        visible: false,
                    });
                }
                provisionalGroups.push({
                    fieldStates,
                    instanceCount: 0,
                    isInteracting: group.raisedBedId === interactingRaisedBedId,
                    isSelected: focusActive && isSelectedRaisedBed,
                    projectedBenefit: 0,
                    raisedBedId: group.raisedBedId,
                    requestedLod: 'far',
                    wasAdmitted: admittedRaisedBedIdsRef.current.has(
                        group.raisedBedId,
                    ),
                });
                continue;
            }

            const fieldStates: Array<{
                fieldKey: string;
                requestedLevel: PlantLodLevel;
                visible: boolean;
            }> = [];
            let instanceCount = 0;
            let projectedBenefit = 0;
            let requestedLod: PlantLodLevel = 'far';

            for (const field of group.fields) {
                if (profileActive) {
                    evaluatedFieldCount += 1;
                }
                worldPosition.set(...field.position);
                const screenOccupancy =
                    Math.max(field.approximatePlantHeight, 0.25) /
                    viewportHeight;
                let visible = true;
                if (!(focusActive && isSelectedRaisedBed)) {
                    if (profileActive) {
                        fieldProjectionTestCount += 1;
                    }
                    visible = resolveGeneratedFieldVisibility({
                        approximatePlantHeight: field.approximatePlantHeight,
                        camera,
                        projectedPosition,
                        viewportHeight,
                        worldPosition,
                    });
                }
                const previousLevel =
                    lodByFieldKeyRef.current.get(field.fieldKey)
                        ?.requestedLevel ?? 'far';
                const requestedLevel = resolveGeneratedPlantFieldLod({
                    cameraZoom: getOrthographicCameraZoom(camera),
                    currentLevel: previousLevel,
                    focusActive,
                    isSelectedRaisedBed,
                    nearHysteresis,
                    nearThreshold,
                    screenOccupancy,
                });

                fieldStates.push({
                    fieldKey: field.fieldKey,
                    requestedLevel: visible ? requestedLevel : 'far',
                    visible,
                });
                if (!visible) {
                    nextLodByFieldKey.set(field.fieldKey, {
                        level: 'far',
                        requestedLevel: 'far',
                        visible: false,
                    });
                    continue;
                }

                requestedLod = getMostDetailedPlantLod(
                    requestedLod,
                    requestedLevel,
                );
                instanceCount += field.instances.length;
                projectedBenefit +=
                    screenOccupancy * screenOccupancy * field.instances.length;
            }

            provisionalGroups.push({
                fieldStates,
                instanceCount,
                isInteracting: group.raisedBedId === interactingRaisedBedId,
                isSelected: focusActive && isSelectedRaisedBed,
                projectedBenefit,
                raisedBedId: group.raisedBedId,
                requestedLod,
                wasAdmitted: admittedRaisedBedIdsRef.current.has(
                    group.raisedBedId,
                ),
            });
        }
        const allocation = allocateGeneratedPlantDetailBudget(
            provisionalGroups.map((group) => ({
                instanceCount: group.instanceCount,
                isInteracting: group.isInteracting,
                isSelected: group.isSelected,
                projectedBenefit: group.projectedBenefit,
                raisedBedId: group.raisedBedId,
                requestedLod: group.requestedLod,
                wasAdmitted: group.wasAdmitted,
            })),
            { instanceBudget: detailInstanceBudget },
        );
        const nextAdmittedRaisedBedIds = new Set<number>();
        allocation.decisions.forEach((decision, groupIndex) => {
            const group = provisionalGroups[groupIndex];
            if (!group) {
                return;
            }
            if (decision.detailAdmitted) {
                nextAdmittedRaisedBedIds.add(decision.raisedBedId);
            }

            for (const fieldState of group.fieldStates) {
                if (!fieldState.visible) {
                    continue;
                }

                nextLodByFieldKey.set(fieldState.fieldKey, {
                    level:
                        group.requestedLod === 'near'
                            ? decision.resolvedLod
                            : fieldState.requestedLevel,
                    requestedLevel: fieldState.requestedLevel,
                    visible: true,
                });
            }
        });
        admittedRaisedBedIdsRef.current = nextAdmittedRaisedBedIds;
        if (profileActive) {
            recordGeneratedPlantProfileLodEvaluation(
                {
                    durationMs: performance.now() - profileStartedAt,
                    fieldEvaluationCount: evaluatedFieldCount,
                    fieldProjectionTestCount,
                    groupRejectionCount,
                    groupTestCount,
                },
                profileSessionId ?? undefined,
            );
        }

        setLodSnapshot((current) => {
            if (
                current.lodByFieldKey.size !== nextLodByFieldKey.size ||
                !areDetailBudgetStatsEqual(
                    current.detailBudget,
                    allocation.stats,
                )
            ) {
                return {
                    detailBudget: allocation.stats,
                    lodByFieldKey: nextLodByFieldKey,
                };
            }

            for (const [key, nextState] of nextLodByFieldKey) {
                const currentState = current.lodByFieldKey.get(key);
                if (
                    !currentState ||
                    currentState.level !== nextState.level ||
                    currentState.requestedLevel !== nextState.requestedLevel ||
                    currentState.visible !== nextState.visible
                ) {
                    return {
                        detailBudget: allocation.stats,
                        lodByFieldKey: nextLodByFieldKey,
                    };
                }
            }

            return current;
        });
    }, [
        camera,
        detailInstanceBudget,
        focusActive,
        frustum,
        generatedFields.length,
        interactingRaisedBedId,
        nearHysteresis,
        nearThreshold,
        projectedPosition,
        projectionViewMatrix,
        raisedBedGroups,
        selectedRaisedBedId,
        viewport,
        worldPosition,
    ]);

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

    return lodSnapshot;
}

export function RaisedBedGeneratedPlantFieldBatches({
    blocks,
    quality,
}: {
    blocks: RaisedBedGeneratedPlantFieldBatchBlock[];
    quality: GameQualityProfile;
}) {
    const { includePendingCartPlants, renderDetails } = useGameSceneDetails();
    const { data: currentGarden } = useCurrentGarden();
    const { data: operations } = useOperations();
    const isMock = useGameState((state) => state.isMock);
    const mockGardenProfile = useGameState((state) => state.mockGardenProfile);
    const { data: sortData } = useAllSorts(!isMock);
    const isSandbox = useIsSandboxGarden();
    const isLocalSandbox = useGameState(
        (state) => state.localSandboxStorageKey !== null,
    );
    const view = useGameState((state) => state.view);
    const closeupBlockId = useGameState((state) => state.closeupBlock?.id);
    const closeupCameraActive = useGameState(
        (state) => state.closeupCameraActive,
    );
    const hoveredBlockId = useHoveredBlockStore(
        (state) => state.hoveredBlock?.id ?? null,
    );
    const currentTime = useSnapshotTime();
    const { data: cart } = useShoppingCart(
        includePendingCartPlants && renderDetails && !isLocalSandbox && !isMock,
    );
    const generatedFields = useMemo(() => {
        const fields: GeneratedPlantField[] = [];

        if (!renderDetails || !currentGarden) {
            return fields;
        }

        const visualRewardsByRaisedBedId = new Map(
            currentGarden.raisedBeds.map((raisedBed) => [
                raisedBed.id,
                resolveOperationVisualRewards({
                    appliedOperations: (raisedBed.appliedOperations ?? []).map(
                        (operation) => ({
                            ...operation,
                            raisedBedId: raisedBed.id,
                        }),
                    ),
                    operationItems: [],
                    operations: operations ?? [],
                }),
            ]),
        );

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
            const protectiveCoverPositionSet = new Set(
                resolveRaisedBedProtectiveCoverPositions({
                    blockOffset,
                    fields: raisedBed.fields,
                    raisedBedId: raisedBed.id,
                    visualRewards:
                        visualRewardsByRaisedBedId.get(raisedBed.id) ?? [],
                }),
            );
            const supportPositionSet = new Set(
                resolveRaisedBedSupportPositions({
                    blockOffset,
                    fields: raisedBed.fields,
                    raisedBedId: raisedBed.id,
                    visualRewards:
                        visualRewardsByRaisedBedId.get(raisedBed.id) ?? [],
                }),
            );
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
                if (
                    protectiveCoverPositionSet.has(
                        field.positionIndex - blockOffset,
                    )
                ) {
                    continue;
                }
                const plantSortId = field.plantSortId;
                const sort = sortData?.find((item) => item.id === plantSortId);
                const highTargetAttributes =
                    mockGardenProfile === 'high-target' && plantSortId
                        ? highTargetMockPlantRenderAttributesBySortId[
                              plantSortId
                          ]
                        : undefined;
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
                    !shouldRenderRaisedBedPlant(field)
                ) {
                    continue;
                }

                const { plantsPerRow, totalPlants } = calculatePlantsPerField(
                    highTargetAttributes?.seedingDistance ??
                        sort?.information.plant.attributes?.seedingDistance,
                    sort?.information.name ??
                        mockPlantPresetLabelsBySortId[plantSortId] ??
                        `Plant sort #${plantSortId.toString()}`,
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
                    lifecycleWindowDays: getPlantMaturityWindowDays({
                        germinationWindowMax:
                            highTargetAttributes?.germinationWindowMax ??
                            sort?.information.plant.attributes
                                ?.germinationWindowMax,
                        growthWindowMax:
                            highTargetAttributes?.growthWindowMax ??
                            sort?.information.plant.attributes?.growthWindowMax,
                    }),
                    growthMultiplier: resolvedPlantPreset.growthMultiplier,
                    plantStatus: field.plantStatus,
                });
                const plantInstanceScale = getInGamePlantInstanceScale(
                    resolvedPlantPreset,
                    safePlantsPerRow,
                );
                const supported = supportPositionSet.has(
                    field.positionIndex - blockOffset,
                );
                const plantDefinition = getInGamePlantDefinition(
                    resolvedPlantPreset,
                    supported,
                );
                const fieldPosition = getFieldPosition({
                    blockIndex,
                    blockPosition: block.position,
                    orientation,
                    positionIndex: field.positionIndex - blockOffset,
                });
                const approximatePlantHeight =
                    getApproximatePlantHeight(plantDefinition) *
                    plantInstanceScale;
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
                        fieldKey: getFieldRenderKey(block.blockId, field),
                        position: [
                            fieldPosition[0] + slotX,
                            fieldPosition[1] + 0.02,
                            fieldPosition[2] + slotZ,
                        ],
                        scale: plantInstanceScale,
                        raisedBedId: raisedBed.id,
                        seed: `${block.blockId}:${plantSortId}:${field.positionIndex}:${index}`,
                    });
                }

                fields.push({
                    approximatePlantHeight,
                    blockId: block.blockId,
                    definition: plantDefinition,
                    fieldKey: getFieldRenderKey(block.blockId, field),
                    instances,
                    position: fieldPosition,
                    raisedBedId: raisedBed.id,
                    renderVariant: `${resolvedPlantPreset.plantType}:${supported ? 'supported' : 'free'}`,
                });
            }
        }

        const sceneBlockById = new Map(
            blocks.map((block) => [block.blockId, block]),
        );
        for (const raisedBed of currentGarden.raisedBeds) {
            if (raisedBed.status === 'abandoned') {
                continue;
            }

            const orientation = raisedBed.orientation ?? 'vertical';
            const blockIds = getRaisedBedBlockIds(currentGarden, raisedBed.id);
            if (blockIds.length === 0) {
                continue;
            }

            const fieldPositionByIndex = new Map<
                number,
                readonly [number, number, number]
            >();
            const blockIdByPositionIndex = new Map<number, string>();
            for (const [blockIndex, blockId] of blockIds.entries()) {
                const sceneBlock = sceneBlockById.get(blockId);
                if (!sceneBlock) {
                    continue;
                }
                const blockOffset =
                    Math.max(blockIds.length - 1 - blockIndex, 0) * 9;
                for (
                    let localPositionIndex = 0;
                    localPositionIndex < 9;
                    localPositionIndex += 1
                ) {
                    const positionIndex = blockOffset + localPositionIndex;
                    fieldPositionByIndex.set(
                        positionIndex,
                        getFieldPosition({
                            blockIndex,
                            blockPosition: sceneBlock.position,
                            orientation,
                            positionIndex: localPositionIndex,
                        }),
                    );
                    blockIdByPositionIndex.set(positionIndex, blockId);
                }
            }

            const selectedPlantings = buildAdvancedSowingGardenPlantingVisuals(
                readRaisedBedPlantings(raisedBed),
                blockIds.length * 9,
            );
            for (const planting of selectedPlantings) {
                const generation = getSelectedPlantingVisualGeneration(
                    planting.lifecycleStatus,
                );
                if (generation === null) {
                    continue;
                }
                const layout = buildAdvancedSowingPlantVisualLayout({
                    fieldPositionByIndex,
                    planting,
                });
                const anchorBlockId = blockIdByPositionIndex.get(
                    planting.anchorPositionIndex,
                );
                if (!layout || !anchorBlockId) {
                    continue;
                }

                const sort = sortData?.find(
                    (item) => item.id === planting.plantSortId,
                );
                // Catalogue labels select the existing visual archetype only.
                // Density, count, footprint, and growth all come from the
                // persisted planting snapshot and lifecycle projection above.
                const resolvedPlantPreset = resolveInGamePlantPreset([
                    sort?.information.name,
                    sort?.information.plant.information?.name,
                    sort?.information.plant.information?.latinName,
                    isMock || isSandbox
                        ? mockPlantPresetLabelsBySortId[planting.plantSortId]
                        : undefined,
                ]);
                if (!resolvedPlantPreset) {
                    continue;
                }

                const plantInstanceScale = getInGamePlantInstanceScale(
                    resolvedPlantPreset,
                    planting.plantsPerAxis,
                );
                const plantDefinition = getInGamePlantDefinition(
                    resolvedPlantPreset,
                    false,
                );
                const fieldKey = `advanced-sowing:${raisedBed.id.toString()}:${planting.id.toString()}`;
                const instances = layout.instancePositions.map(
                    (
                        position,
                        index,
                    ): RaisedBedGeneratedPlantBatchInstance => ({
                        fieldKey,
                        generation,
                        position,
                        raisedBedId: raisedBed.id,
                        scale: plantInstanceScale,
                        seed: `${fieldKey}:${planting.plantSortId.toString()}:${index.toString()}`,
                    }),
                );

                fields.push({
                    approximatePlantHeight:
                        getApproximatePlantHeight(plantDefinition) *
                        plantInstanceScale,
                    blockId: anchorBlockId,
                    definition: plantDefinition,
                    fieldKey,
                    instances,
                    position: layout.centroid,
                    raisedBedId: raisedBed.id,
                    renderVariant: `${resolvedPlantPreset.plantType}:advanced-selected`,
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
        mockGardenProfile,
        operations,
        renderDetails,
        sortData,
    ]);
    const selectedRaisedBedId = useMemo(() => {
        if (!currentGarden || !closeupBlockId) {
            return null;
        }

        return (
            findRaisedBedByBlockId(currentGarden, closeupBlockId)?.id ?? null
        );
    }, [closeupBlockId, currentGarden]);
    const interactingRaisedBedId = useMemo(() => {
        if (!currentGarden || !hoveredBlockId) {
            return null;
        }

        return (
            findRaisedBedByBlockId(currentGarden, hoveredBlockId)?.id ?? null
        );
    }, [currentGarden, hoveredBlockId]);
    const focusActive =
        selectedRaisedBedId !== null &&
        (view === 'closeup' || closeupCameraActive);
    const leafGeometryDetail = resolvePlantLeafGeometryDetail(quality.tier);
    const generatedPlantInstanceCount = useMemo(
        () =>
            generatedFields.reduce(
                (total, field) => total + field.instances.length,
                0,
            ),
        [generatedFields],
    );
    const legacyDetailBudget =
        mockGardenProfile === 'high-target' &&
        resolveLegacyGeneratedPlantDetailBudget(
            typeof window === 'undefined' ? undefined : window.location.search,
        );
    const globalDetailBudgetActive = isGeneratedPlantDetailBudgetActive(
        quality.tier,
        legacyDetailBudget,
    );
    const detailInstanceBudget = globalDetailBudgetActive
        ? HIGH_GENERATED_PLANT_DETAIL_INSTANCE_BUDGET
        : generatedPlantInstanceCount;
    const expandedHighQualityDetail = quality.tier === 'high';
    const { detailBudget, lodByFieldKey: lods } = useGeneratedPlantFieldLods({
        detailInstanceBudget,
        focusActive,
        generatedFields,
        interactingRaisedBedId,
        nearHysteresis: expandedHighQualityDetail
            ? HIGH_QUALITY_PLANT_NEAR_HYSTERESIS
            : undefined,
        nearThreshold: expandedHighQualityDetail
            ? HIGH_QUALITY_PLANT_NEAR_THRESHOLD
            : undefined,
        selectedRaisedBedId,
    });
    const detailTransitionTotalsRef = useRef({
        evicted: 0,
        promoted: 0,
        released: 0,
    });
    const lastAccumulatedDetailBudgetRef =
        useRef<GeneratedPlantDetailBudgetStats | null>(null);
    // biome-ignore lint/correctness/useExhaustiveDependencies: transition totals are scoped to the active garden fixture.
    useEffect(() => {
        detailTransitionTotalsRef.current = {
            evicted: 0,
            promoted: 0,
            released: 0,
        };
        lastAccumulatedDetailBudgetRef.current = null;
    }, [currentGarden?.id, mockGardenProfile]);
    useEffect(() => {
        if (lastAccumulatedDetailBudgetRef.current === detailBudget) {
            return;
        }

        detailTransitionTotalsRef.current.evicted +=
            detailBudget.evictedBedCount;
        detailTransitionTotalsRef.current.promoted +=
            detailBudget.promotedBedCount;
        detailTransitionTotalsRef.current.released +=
            detailBudget.releasedBedCount;
        lastAccumulatedDetailBudgetRef.current = detailBudget;
    }, [detailBudget]);
    useEffect(() => {
        const sessionId = getGeneratedPlantProfileSessionId();
        if (sessionId === null) {
            return;
        }

        recordGeneratedPlantProfileFields(
            generatedFields.map((field) => {
                const lod = lods.get(field.fieldKey);
                return {
                    fieldKey: field.fieldKey,
                    instanceCount: field.instances.length,
                    lodLevel: lod?.level ?? 'far',
                    raisedBedId: field.raisedBedId,
                    visible: lod?.visible ?? false,
                };
            }),
            sessionId,
        );
    }, [generatedFields, lods]);
    const previousDetailedBatchesRef = useRef<
        readonly GeneratedPlantBatch[] | undefined
    >(undefined);
    const previousClusterBatchesRef = useRef<
        readonly GeneratedPlantClusterBatch[] | undefined
    >(undefined);
    const compiledBatches = useMemo(() => {
        const detailedBatchMap = new Map<string, GeneratedPlantBatch>();
        const clusterBatchMap = new Map<string, GeneratedPlantClusterBatch>();

        for (const field of generatedFields) {
            const lod = lods.get(field.fieldKey);
            if (!lod?.visible) {
                continue;
            }

            const focused =
                focusActive && field.raisedBedId === selectedRaisedBedId;
            if (lod.level !== 'near') {
                const batchKey = globalDetailBudgetActive
                    ? `${lod.level}:bed:${field.raisedBedId.toString()}`
                    : getGeneratedPlantBatchKey({
                          focused: false,
                          lodLevel: lod.level,
                          plantType: field.renderVariant,
                          raisedBedId: field.raisedBedId,
                      });
                const clusterBatch = clusterBatchMap.get(batchKey);
                const clusterField = {
                    definition: field.definition,
                    fieldKey: field.fieldKey,
                    instances: field.instances,
                    renderVariant: field.renderVariant,
                } satisfies RaisedBedGeneratedPlantClusterField;

                if (clusterBatch) {
                    clusterBatch.fields.push(clusterField);
                } else {
                    clusterBatchMap.set(batchKey, {
                        batchKey,
                        fields: [clusterField],
                        lodLevel: lod.level,
                        signature: '',
                    });
                }
                continue;
            }

            const batchKey = getGeneratedPlantBatchKey({
                focused,
                lodLevel: 'near',
                plantType: field.renderVariant,
                raisedBedId: field.raisedBedId,
            });
            let batch = detailedBatchMap.get(batchKey);

            if (!batch) {
                batch = {
                    batchKey,
                    definition: field.definition,
                    instances: [],
                    lodLevel: 'near',
                    signature: '',
                    taskPriority: focused
                        ? 'focused'
                        : focusActive
                          ? 'background'
                          : 'normal',
                };
                detailedBatchMap.set(batchKey, batch);
            }

            batch.instances.push(...field.instances);
        }

        return {
            clusterBatches: Array.from(clusterBatchMap.values(), (batch) => ({
                ...batch,
                signature: [
                    batch.lodLevel,
                    ...batch.fields.flatMap((field) => [
                        field.fieldKey,
                        field.definition.name,
                        field.renderVariant,
                        ...field.instances.map(
                            getGeneratedPlantInstanceSignature,
                        ),
                    ]),
                ].join('|'),
            })),
            detailedBatches: Array.from(detailedBatchMap.values(), (batch) => ({
                ...batch,
                signature: [
                    batch.lodLevel,
                    batch.definition.name,
                    batch.taskPriority,
                    ...batch.instances.map(getGeneratedPlantInstanceSignature),
                ].join('|'),
            })),
        };
    }, [
        focusActive,
        generatedFields,
        globalDetailBudgetActive,
        lods,
        selectedRaisedBedId,
    ]);
    const detailedBatches = useMemo(() => {
        const reconciled = reconcileGeneratedPlantBatches(
            previousDetailedBatchesRef.current,
            compiledBatches.detailedBatches,
        );
        previousDetailedBatchesRef.current = reconciled;
        return reconciled;
    }, [compiledBatches.detailedBatches]);
    const clusterBatches = useMemo(() => {
        const reconciled = reconcileGeneratedPlantBatches(
            previousClusterBatchesRef.current,
            compiledBatches.clusterBatches,
        );
        previousClusterBatchesRef.current = reconciled;
        return reconciled;
    }, [compiledBatches.clusterBatches]);
    const generatedPlantBatchCount =
        detailedBatches.length + clusterBatches.length;
    const representationCounts = useMemo(() => {
        const counts = {
            farFields: 0,
            farInstances: 0,
            midFields: 0,
            midInstances: 0,
            nearFields: 0,
            nearInstances: 0,
        };

        for (const field of generatedFields) {
            const lod = lods.get(field.fieldKey);
            if (!lod?.visible) {
                continue;
            }

            const fieldKey = `${lod.level}Fields` as const;
            const instanceKey = `${lod.level}Instances` as const;
            counts[fieldKey] += 1;
            counts[instanceKey] += field.instances.length;
        }

        return counts;
    }, [generatedFields, lods]);
    const highTargetOperationVisuals =
        mockGardenProfile === 'high-target' &&
        resolveHighTargetOperationVisualsEnabled(
            typeof window === 'undefined' ? undefined : window.location.search,
        );
    useEffect(() => {
        updateGameProfileMetadata({
            generatedPlantBatchCount,
            generatedPlantDetailAdmittedBedCount: detailBudget.admittedBedCount,
            generatedPlantDetailAdmittedInstanceCount:
                detailBudget.admittedInstanceCount,
            generatedPlantDetailBudgetInstanceCount:
                detailBudget.instanceBudget,
            generatedPlantDetailDemotedBedCount: detailBudget.demotedBedCount,
            generatedPlantDetailEvictedBedCount: detailBudget.evictedBedCount,
            generatedPlantDetailOverflowInstanceCount:
                detailBudget.overflowInstanceCount,
            generatedPlantDetailPromotedBedCount: detailBudget.promotedBedCount,
            generatedPlantDetailRequestedBedCount:
                detailBudget.requestedBedCount,
            generatedPlantDetailRequestedInstanceCount:
                detailBudget.requestedInstanceCount,
            generatedPlantDetailRetainedBedCount: detailBudget.retainedBedCount,
            generatedPlantDetailTransitionCount:
                detailTransitionTotalsRef.current.evicted +
                detailTransitionTotalsRef.current.promoted +
                detailTransitionTotalsRef.current.released,
            generatedPlantDetailUsedBudgetInstanceCount:
                detailBudget.usedBudgetInstanceCount,
            generatedPlantFarFieldCount: representationCounts.farFields,
            generatedPlantFarInstanceCount: representationCounts.farInstances,
            generatedPlantFieldCount: generatedFields.length,
            generatedPlantInstanceCount,
            generatedPlantMidFieldCount: representationCounts.midFields,
            generatedPlantMidInstanceCount: representationCounts.midInstances,
            generatedPlantNearFieldCount: representationCounts.nearFields,
            generatedPlantNearInstanceCount: representationCounts.nearInstances,
            generatedPlantExpectedInstanceCount:
                mockGardenProfile === 'high-target'
                    ? highTargetOperationVisuals
                        ? getHighTargetOperationVisualFixtureCounts()
                              .generatedPlantInstanceCount
                        : getHighTargetMockGardenPlantInstanceCount()
                    : undefined,
            generatedPlantVisibleFieldCount: generatedFields.filter(
                (field) => lods.get(field.fieldKey)?.visible === true,
            ).length,
            generatedPlantVisibleInstanceCount: generatedFields.reduce(
                (total, field) =>
                    lods.get(field.fieldKey)?.visible === true
                        ? total + field.instances.length
                        : total,
                0,
            ),
        });
    }, [
        detailBudget,
        generatedPlantBatchCount,
        generatedFields,
        generatedPlantInstanceCount,
        highTargetOperationVisuals,
        lods,
        mockGardenProfile,
        representationCounts,
    ]);

    if (!renderDetails || generatedPlantBatchCount === 0) {
        return null;
    }

    return (
        <group
            name={`RaisedBedGeneratedPlantFieldBatches:batches:${generatedPlantBatchCount.toString()}`}
        >
            {detailedBatches.map((batch) => (
                <MemoRaisedBedGeneratedPlantBatch
                    key={batch.batchKey}
                    definition={batch.definition}
                    instances={batch.instances}
                    leafGeometryDetail={leafGeometryDetail}
                    lodLevel={batch.lodLevel}
                    taskPriority={batch.taskPriority}
                />
            ))}
            {clusterBatches.map((batch) => (
                <MemoRaisedBedGeneratedPlantClusterBatch
                    key={batch.batchKey}
                    batchKey={batch.batchKey}
                    fields={batch.fields}
                    lodLevel={batch.lodLevel}
                />
            ))}
        </group>
    );
}
