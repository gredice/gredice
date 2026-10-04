import type { BlockData } from '@gredice/client';
import { Vector3 } from 'three';
import type { Stack } from '../../types/Stack';
import { getStackHeight } from '../../utils/getStackHeight';
import { getRaisedBedFootprintSegments } from '../../utils/raisedBedBlocks';
import { isRaisedBedFieldOccupied } from '../../utils/raisedBedFields';
import {
    getGridPositionFromIndex,
    type RaisedBedOrientation,
} from '../../utils/raisedBedOrientation';
import { getCactusVariantConfig } from '../Cactus';
import { getBlockSurfaceDecorations } from '../groundDecorations/getBlockSurfaceDecorations';
import { resolveGroundDecorationSurface } from '../groundDecorations/groundDecorationConfig';
import { tulipBouquetStems } from '../tulipBouquet';

export type PollinatorRaisedBedField = {
    active?: boolean | null;
    plantSortId?: number | null;
    plantStatus?: string | null;
    positionIndex: number;
};

export type PollinatorGarden = {
    id?: number | string;
    raisedBeds: {
        blockId: string | null;
        fields?: PollinatorRaisedBedField[] | null;
        id: number;
        orientation?: RaisedBedOrientation;
    }[];
    stacks: Stack[];
};

export type PollinatorFlowerTarget = {
    id: string;
    blockIds?: string[];
    kind: 'flower' | 'raised-bed-flower' | 'cactus-flower' | 'ground-flower';
    position: Vector3;
};

const groundDecorationBlockYOffset = 0.2;
const groundFlowerHoverHeight = 0.08;
const raisedBedFlowerHoverHeight = 0.42;
const cactusFlowerHoverHeight = 0.08;
const tulipFlowerHoverHeight = 0.52;
const yAxis = new Vector3(0, 1, 0);

function findBlockPlacement(stacks: Stack[], blockId: string) {
    for (const stack of stacks) {
        const block = stack.blocks.find(
            (candidate) => candidate.id === blockId,
        );
        if (block) {
            return { block, stack };
        }
    }

    return null;
}

function rotateLocalPosition(localPosition: Vector3, rotation: number) {
    return localPosition
        .clone()
        .applyAxisAngle(yAxis, rotation * (Math.PI / 2));
}

function createTulipTargets(
    stacks: Stack[],
    blockData: BlockData[] | null | undefined,
) {
    const targets: PollinatorFlowerTarget[] = [];

    for (const stack of stacks) {
        for (const block of stack.blocks) {
            if (block.name !== 'Tulip') {
                continue;
            }

            const baseHeight = getStackHeight(blockData, stack, block);
            for (const stem of tulipBouquetStems) {
                const offset = rotateLocalPosition(
                    new Vector3(stem.position[0], 0, stem.position[2]),
                    block.rotation,
                );
                targets.push({
                    id: `tulip-${block.id}-${stem.key}`,
                    blockIds: [block.id],
                    kind: 'flower',
                    position: new Vector3(
                        stack.position.x + offset.x,
                        baseHeight + tulipFlowerHoverHeight + stem.position[1],
                        stack.position.z + offset.z,
                    ),
                });
            }
        }
    }

    return targets;
}

function isPollinatorFloweringField(field: PollinatorRaisedBedField) {
    return (
        isRaisedBedFieldOccupied(field) &&
        (field.plantStatus === 'firstFlowers' ||
            field.plantStatus === 'firstFruitSet' ||
            field.plantStatus === 'ready')
    );
}

function createRaisedBedTargets(
    garden: PollinatorGarden,
    blockData: BlockData[] | null | undefined,
) {
    const targets: PollinatorFlowerTarget[] = [];

    for (const raisedBed of garden.raisedBeds) {
        const fields =
            raisedBed.fields?.filter(isPollinatorFloweringField) ?? [];
        if (fields.length <= 0) {
            continue;
        }

        const orientation = raisedBed.orientation ?? 'vertical';
        const blockId = raisedBed.blockId;
        if (!blockId) {
            continue;
        }

        const placement = findBlockPlacement(garden.stacks, blockId);
        if (!placement) {
            continue;
        }

        const currentStackHeight = getStackHeight(
            blockData,
            placement.stack,
            placement.block,
        );
        for (const segment of getRaisedBedFootprintSegments(
            placement.block.rotation,
        )) {
            const blockIndex = segment.blockIndex;
            const blockOffset = segment.blockOffset;
            const offsetX =
                orientation === 'vertical' ? 0.31 - blockIndex * 0.05 : 0.27;
            const offsetY =
                orientation === 'vertical' ? 0.27 : 0.27 + blockIndex * 0.05;
            const multiplierX = orientation === 'vertical' ? 0.285 : 0.27;
            const multiplierY = orientation === 'vertical' ? 0.27 : 0.285;

            for (const field of fields) {
                const localPositionIndex = field.positionIndex - blockOffset;
                if (localPositionIndex < 0 || localPositionIndex >= 9) {
                    continue;
                }

                const { row, col } = getGridPositionFromIndex(
                    localPositionIndex,
                    orientation,
                );
                targets.push({
                    id: `raised-bed-${raisedBed.id}-${field.positionIndex}`,
                    blockIds: [blockId],
                    kind: 'raised-bed-flower',
                    position: new Vector3(
                        placement.stack.position.x +
                            segment.offset.x +
                            col * multiplierX -
                            offsetX,
                        currentStackHeight +
                            1 -
                            0.75 +
                            raisedBedFlowerHoverHeight,
                        placement.stack.position.z +
                            segment.offset.z +
                            (2 - row) * multiplierY -
                            offsetY,
                    ),
                });
            }
        }
    }

    return targets;
}

function createCactusTargets(
    stacks: Stack[],
    blockData: BlockData[] | null | undefined,
) {
    const targets: PollinatorFlowerTarget[] = [];

    for (const stack of stacks) {
        for (const block of stack.blocks) {
            const config = getCactusVariantConfig(block.name);
            if (!config) {
                continue;
            }

            const baseHeight = getStackHeight(blockData, stack, block);
            for (const flower of config.flowers) {
                const offset = rotateLocalPosition(
                    new Vector3(
                        flower.position[0] * config.scale,
                        0,
                        flower.position[2] * config.scale,
                    ),
                    block.rotation,
                );

                targets.push({
                    id: `cactus-${block.id}-${flower.id}`,
                    blockIds: [block.id],
                    kind: 'cactus-flower',
                    position: new Vector3(
                        stack.position.x + offset.x,
                        baseHeight -
                            config.groundSink +
                            flower.position[1] * config.scale +
                            cactusFlowerHoverHeight,
                        stack.position.z + offset.z,
                    ),
                });
            }
        }
    }

    return targets;
}

function createGroundFlowerTargets({
    blockData,
    density,
    garden,
}: {
    blockData: BlockData[] | null | undefined;
    density: number;
    garden: PollinatorGarden;
}) {
    if (density <= 0) {
        return [];
    }

    const targets: PollinatorFlowerTarget[] = [];
    const gardenId = garden.id ?? null;

    for (const stack of garden.stacks) {
        for (const block of stack.blocks) {
            const surface = resolveGroundDecorationSurface(block.name);
            if (!surface) {
                continue;
            }

            const placements = getBlockSurfaceDecorations({
                block,
                density,
                gardenId,
                surface,
            });
            const blockBaseY =
                getStackHeight(blockData, stack, block) +
                groundDecorationBlockYOffset;

            placements.forEach((placement, index) => {
                if (placement.kind !== 'flower') {
                    return;
                }

                const offset = rotateLocalPosition(
                    new Vector3(
                        placement.position[0],
                        0,
                        placement.position[2],
                    ),
                    block.rotation,
                );
                targets.push({
                    id: `ground-flower-${block.id}-${index}`,
                    blockIds: [block.id],
                    kind: 'ground-flower',
                    position: new Vector3(
                        stack.position.x + offset.x,
                        blockBaseY +
                            placement.position[1] +
                            Math.max(
                                groundFlowerHoverHeight,
                                placement.scale * 0.24,
                            ),
                        stack.position.z + offset.z,
                    ),
                });
            });
        }
    }

    return targets;
}

export function createPollinatorPrimaryFlowerTargets(
    garden: PollinatorGarden,
    blockData: BlockData[] | null | undefined,
) {
    return createTulipTargets(garden.stacks, blockData);
}

export function createPollinatorInteractionFlowerTargets({
    blockData,
    garden,
    groundDecorationDensity,
}: {
    blockData: BlockData[] | null | undefined;
    garden: PollinatorGarden;
    groundDecorationDensity: number;
}) {
    return [
        ...createRaisedBedTargets(garden, blockData),
        ...createCactusTargets(garden.stacks, blockData),
        ...createGroundFlowerTargets({
            blockData,
            density: groundDecorationDensity,
            garden,
        }),
    ];
}

export function createAllPollinatorFlowerTargets({
    blockData,
    garden,
    groundDecorationDensity,
}: {
    blockData: BlockData[] | null | undefined;
    garden: PollinatorGarden;
    groundDecorationDensity: number;
}) {
    return [
        ...createPollinatorPrimaryFlowerTargets(garden, blockData),
        ...createPollinatorInteractionFlowerTargets({
            blockData,
            garden,
            groundDecorationDensity,
        }),
    ];
}

export function computePollinatorHabitatCenter(
    targets: readonly PollinatorFlowerTarget[],
) {
    if (targets.length <= 0) {
        return new Vector3();
    }

    const sum = new Vector3();
    for (const target of targets) {
        sum.add(target.position);
    }
    return sum.divideScalar(targets.length);
}
