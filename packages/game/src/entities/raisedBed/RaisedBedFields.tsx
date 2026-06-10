import { useGameFlags } from '../../GameFlagsContext';
import { useGameSceneDetails } from '../../GameSceneDetailContext';
import { resolveInGamePlantPreset } from '../../generators/plant/lib/inGamePlantPresets';
import {
    useCurrentGarden,
    useIsSandboxGarden,
} from '../../hooks/useCurrentGarden';
import { useRaisedBedOperationVisualRewards } from '../../hooks/useRaisedBedOperationVisualRewards';
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
    mockPlantPresetLabelsBySortId,
    RaisedBedPlantField,
} from './RaisedBedPlantField';
import { resolveRaisedBedAgrotextileCoverPositions } from './raisedBedAgrotextileRewards';
import { resolveRaisedBedHarvestPositions } from './raisedBedHarvestRewards';
import { resolveRaisedBedSupportPositions } from './raisedBedSupportRewards';
import { isWateringRewardVisible } from './raisedBedWateringRewards';
import {
    resolveRaisedBedFieldWeedLevel,
    type VisibleRaisedBedWeedLevel,
} from './raisedBedWeedState';

const weedBladePlacements = [
    { id: 'center-left', columnOffset: -0.035, rowOffset: -0.02 },
    { id: 'center', columnOffset: 0, rowOffset: -0.02 },
    { id: 'center-right', columnOffset: 0.035, rowOffset: -0.02 },
    { id: 'back-left', columnOffset: -0.035, rowOffset: 0.02 },
    { id: 'back', columnOffset: 0, rowOffset: 0.02 },
    { id: 'back-right', columnOffset: 0.035, rowOffset: 0.02 },
] as const;

function getRaisedBedFieldSurfacePosition({
    blockIndex,
    orientation,
    positionIndex,
    y,
}: {
    blockIndex: number;
    orientation: RaisedBedOrientation;
    positionIndex: number;
    y: number;
}) {
    const offsetX =
        orientation === 'vertical' ? 0.31 - blockIndex * 0.05 : 0.27;
    const offsetZ =
        orientation === 'vertical' ? 0.27 : 0.27 + blockIndex * 0.05;
    const multiplierX = orientation === 'vertical' ? 0.285 : 0.27;
    const multiplierZ = orientation === 'vertical' ? 0.27 : 0.285;
    const { row, col } = getGridPositionFromIndex(positionIndex, orientation);
    return [
        col * multiplierX - offsetX,
        y,
        (2 - row) * multiplierZ - offsetZ,
    ] satisfies [number, number, number];
}

function RaisedBedFieldMoistSoilOverlay({
    blockIndex,
    orientation,
    positionIndex,
}: {
    blockIndex: number;
    orientation: RaisedBedOrientation;
    positionIndex: number;
}) {
    const position = getRaisedBedFieldSurfacePosition({
        blockIndex,
        orientation,
        positionIndex,
        y: -0.748,
    });

    return (
        <mesh
            position={position}
            rotation={[-Math.PI / 2, 0, 0]}
            renderOrder={1}
        >
            <planeGeometry args={[0.22, 0.22]} />
            <meshStandardMaterial
                color="#2f241d"
                depthWrite={false}
                opacity={0.3}
                polygonOffset
                polygonOffsetFactor={-2}
                roughness={1}
                transparent
            />
        </mesh>
    );
}

function shouldRenderGeneratedPlantField(field: {
    positionIndex: number;
    plantStatus?: string | null;
    plantSowDate?: string | null;
}) {
    return (
        Boolean(field.plantSowDate) &&
        (field.plantStatus === 'sprouted' ||
            field.plantStatus === 'ready' ||
            field.plantStatus === 'harvested')
    );
}

function RaisedBedFieldWeedClump({
    blockIndex,
    level,
    orientation,
    positionIndex,
}: {
    blockIndex: number;
    level: VisibleRaisedBedWeedLevel;
    orientation: RaisedBedOrientation;
    positionIndex: number;
}) {
    const position = getRaisedBedFieldSurfacePosition({
        blockIndex,
        orientation,
        positionIndex,
        y: -0.72,
    });
    const bladeCount = level === 'heavy' ? 6 : 3;

    return (
        <group position={position}>
            {weedBladePlacements
                .slice(0, bladeCount)
                .map((placement, index) => {
                    const height = level === 'heavy' ? 0.16 : 0.12;

                    return (
                        <mesh
                            key={placement.id}
                            position={[
                                placement.columnOffset,
                                height / 2,
                                placement.rowOffset,
                            ]}
                            rotation={[0, index * 0.9, 0]}
                        >
                            <coneGeometry args={[0.022, height, 4]} />
                            <meshStandardMaterial
                                color="#3f6b35"
                                roughness={1}
                            />
                        </mesh>
                    );
                })}
        </group>
    );
}

function RaisedBedFieldAgrotextileCover({
    blockIndex,
    orientation,
    positionIndex,
}: {
    blockIndex: number;
    orientation: RaisedBedOrientation;
    positionIndex: number;
}) {
    const position = getRaisedBedFieldSurfacePosition({
        blockIndex,
        orientation,
        positionIndex,
        y: -0.704,
    });

    return (
        <group position={position}>
            <mesh
                position={[0, 0.004, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                renderOrder={4}
            >
                <planeGeometry args={[0.25, 0.25]} />
                <meshStandardMaterial
                    color="#dcd7c6"
                    depthWrite={false}
                    opacity={0.76}
                    polygonOffset
                    polygonOffsetFactor={-4}
                    roughness={1}
                    transparent
                />
            </mesh>
            <mesh position={[0, 0.012, -0.118]} renderOrder={5}>
                <boxGeometry args={[0.255, 0.008, 0.012]} />
                <meshStandardMaterial color="#eee9d8" roughness={1} />
            </mesh>
            <mesh position={[0, 0.012, 0.118]} renderOrder={5}>
                <boxGeometry args={[0.255, 0.008, 0.012]} />
                <meshStandardMaterial color="#eee9d8" roughness={1} />
            </mesh>
            <mesh position={[-0.118, 0.012, 0]} renderOrder={5}>
                <boxGeometry args={[0.012, 0.008, 0.255]} />
                <meshStandardMaterial color="#eee9d8" roughness={1} />
            </mesh>
            <mesh position={[0.118, 0.012, 0]} renderOrder={5}>
                <boxGeometry args={[0.012, 0.008, 0.255]} />
                <meshStandardMaterial color="#eee9d8" roughness={1} />
            </mesh>
            <mesh position={[0, 0.014, 0]} renderOrder={6}>
                <boxGeometry args={[0.22, 0.006, 0.008]} />
                <meshStandardMaterial color="#c9c2ad" roughness={1} />
            </mesh>
            <mesh position={[0, 0.015, 0]} renderOrder={6}>
                <boxGeometry args={[0.008, 0.006, 0.22]} />
                <meshStandardMaterial color="#c9c2ad" roughness={1} />
            </mesh>
        </group>
    );
}

function RaisedBedFieldSupportVisual({
    blockIndex,
    orientation,
    positionIndex,
}: {
    blockIndex: number;
    orientation: RaisedBedOrientation;
    positionIndex: number;
}) {
    const position = getRaisedBedFieldSurfacePosition({
        blockIndex,
        orientation,
        positionIndex,
        y: -0.724,
    });

    return (
        <group position={position}>
            <mesh castShadow position={[-0.082, 0.24, 0.052]} renderOrder={3}>
                <cylinderGeometry args={[0.012, 0.014, 0.48, 5]} />
                <meshStandardMaterial color="#7a4f2b" roughness={0.9} />
            </mesh>
            <mesh position={[0.004, 0.285, 0.044]} renderOrder={4}>
                <boxGeometry args={[0.17, 0.012, 0.01]} />
                <meshStandardMaterial color="#d8c68e" roughness={1} />
            </mesh>
            <mesh position={[0.002, 0.19, 0.018]} renderOrder={4}>
                <boxGeometry args={[0.145, 0.01, 0.01]} />
                <meshStandardMaterial color="#d8c68e" roughness={1} />
            </mesh>
            <mesh position={[0.054, 0.235, 0.014]} renderOrder={3}>
                <cylinderGeometry args={[0.007, 0.008, 0.32, 5]} />
                <meshStandardMaterial color="#5e7a3d" roughness={1} />
            </mesh>
        </group>
    );
}

function RaisedBedFieldHarvestCrate({
    blockIndex,
    orientation,
    positionIndex,
}: {
    blockIndex: number;
    orientation: RaisedBedOrientation;
    positionIndex: number;
}) {
    const position = getRaisedBedFieldSurfacePosition({
        blockIndex,
        orientation,
        positionIndex,
        y: -0.714,
    });

    return (
        <group position={position}>
            <mesh castShadow position={[0.072, 0.034, -0.078]} renderOrder={4}>
                <boxGeometry args={[0.13, 0.055, 0.095]} />
                <meshStandardMaterial color="#8a5b32" roughness={0.95} />
            </mesh>
            <mesh position={[0.072, 0.072, -0.128]} renderOrder={5}>
                <boxGeometry args={[0.14, 0.018, 0.012]} />
                <meshStandardMaterial color="#b47a43" roughness={0.95} />
            </mesh>
            <mesh position={[0.072, 0.072, -0.028]} renderOrder={5}>
                <boxGeometry args={[0.14, 0.018, 0.012]} />
                <meshStandardMaterial color="#b47a43" roughness={0.95} />
            </mesh>
            <mesh position={[0.006, 0.074, -0.078]} renderOrder={5}>
                <boxGeometry args={[0.012, 0.018, 0.105]} />
                <meshStandardMaterial color="#b47a43" roughness={0.95} />
            </mesh>
            <mesh position={[0.138, 0.074, -0.078]} renderOrder={5}>
                <boxGeometry args={[0.012, 0.018, 0.105]} />
                <meshStandardMaterial color="#b47a43" roughness={0.95} />
            </mesh>
            <mesh position={[0.038, 0.094, -0.078]} renderOrder={6}>
                <sphereGeometry args={[0.018, 8, 6]} />
                <meshStandardMaterial color="#bf3f31" roughness={0.8} />
            </mesh>
            <mesh position={[0.078, 0.1, -0.098]} renderOrder={6}>
                <sphereGeometry args={[0.018, 8, 6]} />
                <meshStandardMaterial color="#e0a12f" roughness={0.8} />
            </mesh>
            <mesh position={[0.112, 0.094, -0.064]} renderOrder={6}>
                <sphereGeometry args={[0.017, 8, 6]} />
                <meshStandardMaterial color="#5f8c44" roughness={0.8} />
            </mesh>
        </group>
    );
}

export function RaisedBedFields({
    blockId,
    generatedPlantsHandledExternally = false,
}: {
    blockId: string;
    generatedPlantsHandledExternally?: boolean;
}) {
    const { renderDetails } = useGameSceneDetails();
    const flags = useGameFlags();
    const { data: currentGarden } = useCurrentGarden();
    const { data: sortData } = useAllSorts();
    const isMock = useGameState((state) => state.isMock);
    const isSandbox = useIsSandboxGarden();
    const isLocalSandbox = useGameState(
        (state) => state.localSandboxStorageKey !== null,
    );
    const { data: cart } = useShoppingCart(renderDetails && !isLocalSandbox);
    const raisedBed = findRaisedBedByBlockId(currentGarden, blockId);
    const visualRewards = useRaisedBedOperationVisualRewards(raisedBed);
    const currentTime = useSnapshotTime();
    const orientation = raisedBed?.orientation ?? 'vertical';

    const blockIds =
        raisedBed && currentGarden
            ? getRaisedBedBlockIds(currentGarden, raisedBed.id)
            : [];

    // Bottom-right most block (last in position-sorted list) is offset 0;
    // other blocks get increasing offsets based on distance from bottom-right
    const blockIndex = blockIds.indexOf(blockId);
    const blockOffset = Math.max(blockIds.length - 1 - blockIndex, 0) * 9;

    const cartItems = cart?.items.filter(
        (item) =>
            item.gardenId === currentGarden?.id &&
            item.raisedBedId === raisedBed?.id &&
            item.entityTypeName === 'plantSort' &&
            typeof item.positionIndex === 'number' &&
            item.positionIndex >= blockOffset &&
            item.positionIndex < blockOffset + 9,
    );

    const displayedFields = [
        ...(raisedBed?.fields?.filter(
            (field) =>
                isRaisedBedFieldOccupied(field) &&
                field.positionIndex >= blockOffset &&
                field.positionIndex < blockOffset + 9,
        ) || []),
        ...(cartItems?.map((item) => {
            if (item.positionIndex === null) return null;
            const field = {
                id: `cart-item-${item.id}`,
                positionIndex: item.positionIndex,
                plantSortId: Number(item.entityId),
            };
            return field;
        }) || []),
    ];
    const generatedPlantsEnabled =
        Boolean(flags.enablePlantGeneratorFlag) || isMock || isSandbox;

    if (!renderDetails) {
        return null;
    }

    const moistFieldIds = new Set(
        visualRewards
            .filter(
                (reward) =>
                    reward.scope === 'field' &&
                    reward.raisedBedFieldId != null &&
                    isWateringRewardVisible(reward, currentTime),
            )
            .map((reward) => reward.raisedBedFieldId),
    );
    const weedFieldVisuals = raisedBed
        ? Array.from({ length: 9 }, (_, localPositionIndex) => {
              const positionIndex = blockOffset + localPositionIndex;
              const field = raisedBed.fields.find(
                  (candidate) =>
                      candidate.active &&
                      candidate.positionIndex === positionIndex,
              );
              const weedLevel = resolveRaisedBedFieldWeedLevel({
                  fieldWeedState: field?.weedState,
                  raisedBedFieldId:
                      typeof field?.id === 'number' ? field.id : null,
                  raisedBedId: raisedBed.id,
                  raisedBedWeedState: raisedBed.weedState,
                  visualRewards,
              });

              return weedLevel
                  ? {
                        level: weedLevel,
                        positionIndex: localPositionIndex,
                    }
                  : null;
          }).filter(
              (
                  visual,
              ): visual is {
                  level: VisibleRaisedBedWeedLevel;
                  positionIndex: number;
              } => Boolean(visual),
          )
        : [];
    const agrotextileCoverPositions = raisedBed
        ? resolveRaisedBedAgrotextileCoverPositions({
              blockOffset,
              fields: raisedBed.fields,
              raisedBedId: raisedBed.id,
              visualRewards,
          })
        : [];
    const agrotextileCoverPositionSet = new Set(agrotextileCoverPositions);
    const supportPositions = raisedBed
        ? resolveRaisedBedSupportPositions({
              blockOffset,
              fields: raisedBed.fields,
              raisedBedId: raisedBed.id,
              visualRewards,
          })
        : [];
    const visibleSupportPositions = supportPositions.filter(
        (positionIndex) => !agrotextileCoverPositionSet.has(positionIndex),
    );
    const harvestPositions = raisedBed
        ? resolveRaisedBedHarvestPositions({
              blockOffset,
              fields: raisedBed.fields,
              raisedBedId: raisedBed.id,
              visualRewards,
          })
        : [];
    const visibleHarvestPositions = harvestPositions.filter(
        (positionIndex) => !agrotextileCoverPositionSet.has(positionIndex),
    );
    const harvestPositionSet = new Set(visibleHarvestPositions);

    return (
        <>
            {displayedFields.map((field) => {
                if (
                    !field ||
                    typeof field.id !== 'number' ||
                    !moistFieldIds.has(field.id)
                ) {
                    return null;
                }

                return (
                    <RaisedBedFieldMoistSoilOverlay
                        key={`raised-bed-field-moist-soil-${field.id}`}
                        blockIndex={blockIndex}
                        orientation={orientation}
                        positionIndex={field.positionIndex - blockOffset}
                    />
                );
            })}
            {weedFieldVisuals.map((visual) =>
                agrotextileCoverPositionSet.has(visual.positionIndex) ? null : (
                    <RaisedBedFieldWeedClump
                        key={`raised-bed-field-weed-${blockId}-${visual.positionIndex}`}
                        blockIndex={blockIndex}
                        level={visual.level}
                        orientation={orientation}
                        positionIndex={visual.positionIndex}
                    />
                ),
            )}
            {displayedFields.map((field) => {
                if (!field) return null;
                const localPositionIndex = field.positionIndex - blockOffset;

                if (agrotextileCoverPositionSet.has(localPositionIndex)) {
                    return null;
                }

                if (
                    generatedPlantsHandledExternally &&
                    generatedPlantsEnabled &&
                    field.plantSortId &&
                    shouldRenderGeneratedPlantField(field)
                ) {
                    const sort = sortData?.find(
                        (item) => item.id === field.plantSortId,
                    );
                    const resolvedPlantPreset = resolveInGamePlantPreset([
                        sort?.information.name,
                        sort?.information.plant.information?.name,
                        sort?.information.plant.information?.latinName,
                        isMock || isSandbox
                            ? mockPlantPresetLabelsBySortId[field.plantSortId]
                            : undefined,
                    ]);

                    if (resolvedPlantPreset) {
                        return null;
                    }
                }

                return (
                    <RaisedBedPlantField
                        key={field.id}
                        field={{
                            ...field,
                            harvestedVisual:
                                harvestPositionSet.has(localPositionIndex),
                            positionIndex: localPositionIndex,
                        }}
                        blockIndex={blockIndex}
                        orientation={orientation}
                    />
                );
            })}
            {visibleSupportPositions.map((positionIndex) => (
                <RaisedBedFieldSupportVisual
                    key={`raised-bed-field-support-${blockId}-${positionIndex}`}
                    blockIndex={blockIndex}
                    orientation={orientation}
                    positionIndex={positionIndex}
                />
            ))}
            {visibleHarvestPositions.map((positionIndex) => (
                <RaisedBedFieldHarvestCrate
                    key={`raised-bed-field-harvest-${blockId}-${positionIndex}`}
                    blockIndex={blockIndex}
                    orientation={orientation}
                    positionIndex={positionIndex}
                />
            ))}
            {agrotextileCoverPositions.map((positionIndex) => (
                <RaisedBedFieldAgrotextileCover
                    key={`raised-bed-field-agrotextile-${blockId}-${positionIndex}`}
                    blockIndex={blockIndex}
                    orientation={orientation}
                    positionIndex={positionIndex}
                />
            ))}
        </>
    );
}
