import { animated, useSpring } from '@react-spring/three';
import { useGameFlags } from '../../GameFlagsContext';
import { useGameSceneDetails } from '../../GameSceneDetailContext';
import { resolveInGamePlantPreset } from '../../generators/plant/lib/inGamePlantPresets';
import {
    useCurrentGarden,
    useIsSandboxGarden,
} from '../../hooks/useCurrentGarden';
import { useAllSorts } from '../../hooks/usePlantSorts';
import { useRaisedBedOperationVisualRewards } from '../../hooks/useRaisedBedOperationVisualRewards';
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
import { resolveEntityNeighbors } from '../helpers/useEntityNeighbors';
import {
    mockPlantPresetLabelsBySortId,
    RaisedBedPlantField,
} from './RaisedBedPlantField';
import {
    hasActiveRaisedBedAgrotextileCover,
    resolveRaisedBedAgrotextileCoverPositions,
} from './raisedBedAgrotextileRewards';
import { resolveRaisedBedHarvestPositions } from './raisedBedHarvestRewards';
import { resolveRaisedBedSupportPositions } from './raisedBedSupportRewards';
import { isWateringRewardVisible } from './raisedBedWateringRewards';
import {
    resolveRaisedBedFieldWeedLevel,
    type VisibleRaisedBedWeedLevel,
} from './raisedBedWeedState';

const raisedBedHalfOverlap = 0.05;
const fieldAgrotextileCoverSize = 0.25;
const wholeBedAgrotextileCoverPadding = 0.02;
const wholeBedAgrotextileHemThickness = 0.018;
const raisedBedFieldCount = 9;
const weedFieldScatterRadius = 0.108;
const weedBladeIds = [
    'sprout-a',
    'sprout-b',
    'sprout-c',
    'sprout-d',
    'sprout-e',
    'sprout-f',
    'sprout-g',
    'sprout-h',
    'sprout-i',
    'sprout-j',
] as const;

type CurrentGardenData = NonNullable<
    NonNullable<ReturnType<typeof useCurrentGarden>['data']>
>;

type RaisedBedBlockSurfaceOrigin = {
    x: number;
    z: number;
};

type RaisedBedWholeAgrotextileCoverLayout = {
    depth: number;
    position: [number, number, number];
    width: number;
};

function findRaisedBedBlockPlacement(
    garden: CurrentGardenData,
    blockId: string,
) {
    for (const stack of garden.stacks) {
        const block = stack.blocks.find(
            (candidate) => candidate.id === blockId,
        );
        if (block) {
            return { block, stack };
        }
    }

    return null;
}

function getRaisedBedBlockSurfaceOrigin(
    garden: CurrentGardenData,
    blockId: string,
): RaisedBedBlockSurfaceOrigin | null {
    const placement = findRaisedBedBlockPlacement(garden, blockId);
    if (!placement) {
        return null;
    }

    const neighbors = resolveEntityNeighbors(
        garden.stacks,
        placement.stack,
        placement.block,
    );
    let x = placement.stack.position.x;
    let z = placement.stack.position.z;

    if (neighbors.total === 1) {
        if (neighbors.n) {
            x += raisedBedHalfOverlap;
        } else if (neighbors.e) {
            z -= raisedBedHalfOverlap;
        } else if (neighbors.s) {
            x -= raisedBedHalfOverlap;
        } else if (neighbors.w) {
            z += raisedBedHalfOverlap;
        }
    }

    return { x, z };
}

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

function getRaisedBedWholeAgrotextileCoverLayout({
    blockId,
    blockIds,
    garden,
    orientation,
}: {
    blockId: string;
    blockIds: string[];
    garden: CurrentGardenData;
    orientation: RaisedBedOrientation;
}): RaisedBedWholeAgrotextileCoverLayout | null {
    const ownerOrigin = getRaisedBedBlockSurfaceOrigin(garden, blockId);
    if (!ownerOrigin) {
        return null;
    }

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    const fieldHalfSize = fieldAgrotextileCoverSize / 2;

    for (const [blockIndex, raisedBedBlockId] of blockIds.entries()) {
        const origin = getRaisedBedBlockSurfaceOrigin(garden, raisedBedBlockId);
        if (!origin) {
            continue;
        }

        for (let positionIndex = 0; positionIndex < 9; positionIndex += 1) {
            const [fieldX, , fieldZ] = getRaisedBedFieldSurfacePosition({
                blockIndex,
                orientation,
                positionIndex,
                y: 0,
            });
            const centerX = origin.x - ownerOrigin.x + fieldX;
            const centerZ = origin.z - ownerOrigin.z + fieldZ;

            minX = Math.min(minX, centerX - fieldHalfSize);
            maxX = Math.max(maxX, centerX + fieldHalfSize);
            minZ = Math.min(minZ, centerZ - fieldHalfSize);
            maxZ = Math.max(maxZ, centerZ + fieldHalfSize);
        }
    }

    if (
        !Number.isFinite(minX) ||
        !Number.isFinite(maxX) ||
        !Number.isFinite(minZ) ||
        !Number.isFinite(maxZ)
    ) {
        return null;
    }

    minX -= wholeBedAgrotextileCoverPadding;
    maxX += wholeBedAgrotextileCoverPadding;
    minZ -= wholeBedAgrotextileCoverPadding;
    maxZ += wholeBedAgrotextileCoverPadding;

    return {
        depth: maxZ - minZ,
        position: [(minX + maxX) / 2, -0.704, (minZ + maxZ) / 2],
        width: maxX - minX,
    };
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
        <group position={position}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
                <planeGeometry args={[0.255, 0.255]} />
                <meshStandardMaterial
                    color="#1d201d"
                    depthWrite={false}
                    opacity={0.52}
                    polygonOffset
                    polygonOffsetFactor={-3}
                    roughness={0.72}
                    transparent
                />
            </mesh>
            <mesh
                position={[0.042, 0.004, -0.036]}
                rotation={[-Math.PI / 2, 0, 0.32]}
                scale={[1.7, 0.8, 1]}
                renderOrder={2}
            >
                <circleGeometry args={[0.036, 14]} />
                <meshStandardMaterial
                    color="#6f8f88"
                    depthWrite={false}
                    opacity={0.2}
                    polygonOffset
                    polygonOffsetFactor={-4}
                    roughness={0.32}
                    transparent
                />
            </mesh>
        </group>
    );
}

function RaisedBedFieldVisitSummaryHighlight({
    blockIndex,
    orientation,
    positionIndex,
}: {
    blockIndex: number;
    orientation: RaisedBedOrientation;
    positionIndex: number;
}) {
    const pulse = useSpring({
        from: { opacity: 0.85, scale: 0.82 },
        to: [
            { opacity: 0.3, scale: 1.18 },
            { opacity: 0.85, scale: 0.82 },
        ],
        loop: true,
        duration: 1200,
    });
    const position = getRaisedBedFieldSurfacePosition({
        blockIndex,
        orientation,
        positionIndex,
        y: -0.682,
    });

    return (
        <animated.group position={position} scale={pulse.scale}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={24}>
                <ringGeometry args={[0.155, 0.205, 48]} />
                <animated.meshBasicMaterial
                    color="#f6c445"
                    depthWrite={false}
                    opacity={pulse.opacity}
                    polygonOffset
                    polygonOffsetFactor={-8}
                    transparent
                />
            </mesh>
            <mesh
                position={[0, 0.006, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                renderOrder={23}
            >
                <circleGeometry args={[0.18, 48]} />
                <meshBasicMaterial
                    color="#f6c445"
                    depthWrite={false}
                    opacity={0.12}
                    polygonOffset
                    polygonOffsetFactor={-7}
                    transparent
                />
            </mesh>
        </animated.group>
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

function seededWeedRandom(
    positionIndex: number,
    bladeIndex: number,
    channel: number,
) {
    const value = Math.sin(
        (positionIndex + 1) * 12.9898 +
            (bladeIndex + 1) * 78.233 +
            channel * 37.719,
    );

    return value * 43758.5453 - Math.floor(value * 43758.5453);
}

function weedRange(
    positionIndex: number,
    bladeIndex: number,
    channel: number,
    min: number,
    max: number,
) {
    return (
        min + seededWeedRandom(positionIndex, bladeIndex, channel) * (max - min)
    );
}

function RaisedBedFieldWeeds({
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
    const bladeCount = level === 'heavy' ? 10 : 5;
    const seedPositionIndex = blockIndex * 9 + positionIndex;

    return (
        <group position={position}>
            {weedBladeIds.slice(0, bladeCount).map((bladeId, index) => {
                const height =
                    level === 'heavy'
                        ? weedRange(seedPositionIndex, index, 0, 0.052, 0.085)
                        : weedRange(seedPositionIndex, index, 0, 0.038, 0.062);
                const radius =
                    level === 'heavy'
                        ? weedRange(seedPositionIndex, index, 1, 0.005, 0.008)
                        : weedRange(seedPositionIndex, index, 1, 0.004, 0.006);
                const x = weedRange(
                    seedPositionIndex,
                    index,
                    2,
                    -weedFieldScatterRadius,
                    weedFieldScatterRadius,
                );
                const z = weedRange(
                    seedPositionIndex,
                    index,
                    3,
                    -weedFieldScatterRadius,
                    weedFieldScatterRadius,
                );
                const leanX = weedRange(
                    seedPositionIndex,
                    index,
                    4,
                    -0.18,
                    0.18,
                );
                const leanZ = weedRange(
                    seedPositionIndex,
                    index,
                    5,
                    -0.18,
                    0.18,
                );

                return (
                    <mesh
                        key={`weed-blade-${seedPositionIndex}-${bladeId}`}
                        position={[x, height / 2, z]}
                        rotation={[
                            leanX,
                            weedRange(
                                seedPositionIndex,
                                index,
                                6,
                                0,
                                Math.PI * 2,
                            ),
                            leanZ,
                        ]}
                    >
                        <coneGeometry args={[radius, height, 4]} />
                        <meshStandardMaterial color="#4b7f3b" roughness={1} />
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

function RaisedBedWholeAgrotextileCover({
    layout,
}: {
    layout: RaisedBedWholeAgrotextileCoverLayout;
}) {
    const halfWidth = layout.width / 2;
    const halfDepth = layout.depth / 2;

    return (
        <group position={layout.position}>
            <mesh
                position={[0, 0.004, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                renderOrder={4}
            >
                <planeGeometry args={[layout.width, layout.depth]} />
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
            <mesh position={[0, 0.012, -halfDepth]} renderOrder={5}>
                <boxGeometry
                    args={[
                        layout.width + wholeBedAgrotextileHemThickness,
                        0.008,
                        wholeBedAgrotextileHemThickness,
                    ]}
                />
                <meshStandardMaterial color="#eee9d8" roughness={1} />
            </mesh>
            <mesh position={[0, 0.012, halfDepth]} renderOrder={5}>
                <boxGeometry
                    args={[
                        layout.width + wholeBedAgrotextileHemThickness,
                        0.008,
                        wholeBedAgrotextileHemThickness,
                    ]}
                />
                <meshStandardMaterial color="#eee9d8" roughness={1} />
            </mesh>
            <mesh position={[-halfWidth, 0.012, 0]} renderOrder={5}>
                <boxGeometry
                    args={[
                        wholeBedAgrotextileHemThickness,
                        0.008,
                        layout.depth + wholeBedAgrotextileHemThickness,
                    ]}
                />
                <meshStandardMaterial color="#eee9d8" roughness={1} />
            </mesh>
            <mesh position={[halfWidth, 0.012, 0]} renderOrder={5}>
                <boxGeometry
                    args={[
                        wholeBedAgrotextileHemThickness,
                        0.008,
                        layout.depth + wholeBedAgrotextileHemThickness,
                    ]}
                />
                <meshStandardMaterial color="#eee9d8" roughness={1} />
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
            <mesh castShadow position={[0, 0.24, 0]} renderOrder={3}>
                <cylinderGeometry args={[0.012, 0.014, 0.48, 5]} />
                <meshStandardMaterial color="#7a4f2b" roughness={0.9} />
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
    const visitSummaryHighlight = useGameState(
        (state) => state.gardenVisitSummaryHighlight,
    );

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

    const hasRaisedBedWateringReward = visualRewards.some(
        (reward) =>
            reward.scope === 'raisedBed' &&
            reward.raisedBedId === raisedBed?.id &&
            isWateringRewardVisible(reward, currentTime),
    );
    const moistFieldPositionSet = hasRaisedBedWateringReward
        ? new Set(
              Array.from(
                  { length: raisedBedFieldCount },
                  (_, localPositionIndex) => localPositionIndex,
              ),
          )
        : new Set(
              visualRewards.flatMap((reward) => {
                  if (
                      reward.scope !== 'field' ||
                      reward.raisedBedFieldId == null ||
                      !isWateringRewardVisible(reward, currentTime)
                  ) {
                      return [];
                  }

                  const field = raisedBed?.fields.find(
                      (candidate) =>
                          candidate.active &&
                          candidate.id === reward.raisedBedFieldId,
                  );
                  if (
                      !field ||
                      field.positionIndex < blockOffset ||
                      field.positionIndex >= blockOffset + raisedBedFieldCount
                  ) {
                      return [];
                  }

                  return [field.positionIndex - blockOffset];
              }),
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
    const hasRaisedBedAgrotextileCover = raisedBed
        ? hasActiveRaisedBedAgrotextileCover({
              raisedBedId: raisedBed.id,
              visualRewards,
          })
        : false;
    const wholeBedAgrotextileCoverLayout =
        hasRaisedBedAgrotextileCover &&
        currentGarden &&
        blockIds.length > 0 &&
        blockIndex === 0
            ? getRaisedBedWholeAgrotextileCoverLayout({
                  blockId,
                  blockIds,
                  garden: currentGarden,
                  orientation,
              })
            : null;
    const fieldAgrotextileCoverPositions = hasRaisedBedAgrotextileCover
        ? []
        : agrotextileCoverPositions;
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
    const highlightedPositionIndex =
        raisedBed && visitSummaryHighlight?.raisedBedId === raisedBed.id
            ? (raisedBed.fields.find(
                  (field) =>
                      typeof field.id === 'number' &&
                      field.id === visitSummaryHighlight.fieldId,
              )?.positionIndex ??
              visitSummaryHighlight.positionIndex ??
              null)
            : null;
    const highlightedLocalPositionIndex =
        highlightedPositionIndex != null &&
        highlightedPositionIndex >= blockOffset &&
        highlightedPositionIndex < blockOffset + 9
            ? highlightedPositionIndex - blockOffset
            : null;

    return (
        <>
            {highlightedLocalPositionIndex != null ? (
                <RaisedBedFieldVisitSummaryHighlight
                    blockIndex={blockIndex}
                    orientation={orientation}
                    positionIndex={highlightedLocalPositionIndex}
                />
            ) : null}
            {Array.from(moistFieldPositionSet).map((positionIndex) => (
                <RaisedBedFieldMoistSoilOverlay
                    key={`raised-bed-field-moist-soil-${blockId}-${positionIndex}`}
                    blockIndex={blockIndex}
                    orientation={orientation}
                    positionIndex={positionIndex}
                />
            ))}
            {weedFieldVisuals.map((visual) =>
                agrotextileCoverPositionSet.has(visual.positionIndex) ? null : (
                    <RaisedBedFieldWeeds
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
            {wholeBedAgrotextileCoverLayout && (
                <RaisedBedWholeAgrotextileCover
                    layout={wholeBedAgrotextileCoverLayout}
                />
            )}
            {fieldAgrotextileCoverPositions.map((positionIndex) => (
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
