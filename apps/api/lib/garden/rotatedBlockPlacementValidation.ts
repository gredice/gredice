import {
    canStackBlockOnBlock,
    type GardenBlockDataLike,
    getEffectiveGardenStackBlockHeight,
    getGardenBlockFootprintOffsets,
    isWaterOrSwampBlockName,
    requiresWaterOrSwampSupport,
} from '@gredice/js/gardenBlocks';
import type {
    ValidateRotatedBlockPlacementInput,
    ValidateRotatedBlockPlacementResult,
} from './gardenBlockMutationService';

const minimumStorageInteger = -2_147_483_648;
const maximumStorageInteger = 2_147_483_647;
const maximumBlockIdentifierLength = 128;
const maximumBlockNameLength = 128;
const maximumBlockSpan = 64;
const heightTolerance = 0.0001;

type RotationFailure = Extract<
    ValidateRotatedBlockPlacementResult,
    { valid: false }
>;

type CatalogBlock = Readonly<{
    data: GardenBlockDataLike;
    height: number;
    name: string;
}>;

type PreparedBlock = Readonly<{
    id: string;
    name: string;
    rotation: number | null;
}>;

type PreparedStack = Readonly<{
    blocks: readonly string[];
    positionX: number;
    positionY: number;
}>;

type Coordinate = Readonly<{
    x: number;
    y: number;
}>;

type BlockGeometry = Readonly<{
    block: PreparedBlock;
    bottomHeight: number;
    cells: readonly Coordinate[];
    data: GardenBlockDataLike;
    order: number;
    stackIndex: number;
    topHeight: number;
}>;

class RotatedBlockPlacementError extends Error {
    override readonly name = 'RotatedBlockPlacementError';

    constructor(
        readonly code: RotationFailure['code'],
        readonly status: RotationFailure['status'],
        message: string,
    ) {
        super(message);
    }
}

function fail(
    code: RotationFailure['code'],
    status: RotationFailure['status'],
    message: string,
): never {
    throw new RotatedBlockPlacementError(code, status, message);
}

function isStorageInteger(value: unknown): value is number {
    return (
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= minimumStorageInteger &&
        value <= maximumStorageInteger
    );
}

function isBoundedIdentifier(value: unknown, maximumLength: number) {
    return (
        typeof value === 'string' &&
        value.length > 0 &&
        value.length <= maximumLength &&
        value.trim() === value
    );
}

function coordinateKey(coordinate: Coordinate) {
    return `${coordinate.x.toString()}|${coordinate.y.toString()}`;
}

function equalBlockIds(left: readonly string[], right: readonly string[]) {
    return (
        left.length === right.length &&
        left.every((blockId, index) => blockId === right[index])
    );
}

function prepareCatalog(
    blockData: ValidateRotatedBlockPlacementInput['blockData'],
) {
    const catalog = new Map<string, CatalogBlock>();
    for (const directoryBlock of blockData) {
        const name = directoryBlock.information?.name;
        const attributes = directoryBlock.attributes;
        if (!isBoundedIdentifier(name, maximumBlockNameLength)) {
            fail(
                'BLOCK_DIRECTORY_UNAVAILABLE',
                503,
                'Garden block directory contains an invalid block name.',
            );
        }
        if (catalog.has(name)) {
            fail(
                'BLOCK_DIRECTORY_UNAVAILABLE',
                503,
                'Garden block directory contains duplicate block names.',
            );
        }
        if (
            !attributes ||
            typeof attributes.height !== 'number' ||
            !Number.isFinite(attributes.height) ||
            attributes.height < 0 ||
            typeof attributes.stackable !== 'boolean'
        ) {
            fail(
                'BLOCK_DIRECTORY_UNAVAILABLE',
                503,
                'Garden block directory contains invalid placement data.',
            );
        }
        for (const span of [attributes.spanWidth, attributes.spanDepth]) {
            if (
                span != null &&
                (!Number.isSafeInteger(span) ||
                    span <= 0 ||
                    span > maximumBlockSpan)
            ) {
                fail(
                    'BLOCK_DIRECTORY_UNAVAILABLE',
                    503,
                    'Garden block directory contains an invalid footprint.',
                );
            }
        }
        if (
            attributes.placeableOnWater != null &&
            typeof attributes.placeableOnWater !== 'boolean'
        ) {
            fail(
                'BLOCK_DIRECTORY_UNAVAILABLE',
                503,
                'Garden block directory contains invalid water placement data.',
            );
        }

        const data: GardenBlockDataLike = {
            attributes: {
                height: attributes.height,
                placeableOnWater: attributes.placeableOnWater,
                spanDepth: attributes.spanDepth,
                spanWidth: attributes.spanWidth,
                stackable: attributes.stackable,
            },
        };
        catalog.set(name, {
            data,
            height: attributes.height,
            name,
        });
    }
    return catalog;
}

function prepareBlocks(
    snapshot: ValidateRotatedBlockPlacementInput['snapshot'],
    catalog: ReadonlyMap<string, CatalogBlock>,
) {
    const blocks = new Map<string, PreparedBlock>();
    for (const block of snapshot.blocks) {
        if (
            !isBoundedIdentifier(block.id, maximumBlockIdentifierLength) ||
            !isBoundedIdentifier(block.name, maximumBlockNameLength) ||
            (block.rotation !== null && !isStorageInteger(block.rotation))
        ) {
            fail(
                'GARDEN_STATE_INVALID',
                409,
                'Garden contains an invalid block record.',
            );
        }
        if (blocks.has(block.id)) {
            fail(
                'GARDEN_STATE_INVALID',
                409,
                'Garden contains duplicate active block records.',
            );
        }
        if (!catalog.has(block.name)) {
            fail(
                'BLOCK_DIRECTORY_DATA_NOT_FOUND',
                404,
                'Directory data for an active garden block was not found.',
            );
        }
        blocks.set(block.id, {
            id: block.id,
            name: block.name,
            rotation: block.rotation,
        });
    }
    return blocks;
}

function prepareStacks(
    input: ValidateRotatedBlockPlacementInput,
    blocks: ReadonlyMap<string, PreparedBlock>,
) {
    const stacks = new Map<string, PreparedStack>();
    const placedBlockIds = new Set<string>();
    let candidatePlacement:
        | Readonly<{
              stack: PreparedStack;
              stackIndex: number;
          }>
        | undefined;

    for (const stack of input.snapshot.stacks) {
        if (
            !isStorageInteger(stack.positionX) ||
            !isStorageInteger(stack.positionY) ||
            !Array.isArray(stack.blocks)
        ) {
            fail(
                'GARDEN_STATE_INVALID',
                409,
                'Garden contains an invalid stack record.',
            );
        }
        const key = coordinateKey({ x: stack.positionX, y: stack.positionY });
        if (stacks.has(key)) {
            fail(
                'GARDEN_STATE_INVALID',
                409,
                'Garden contains duplicate active stack coordinates.',
            );
        }

        const preparedBlockIds: string[] = [];
        for (const [stackIndex, blockId] of stack.blocks.entries()) {
            if (!isBoundedIdentifier(blockId, maximumBlockIdentifierLength)) {
                fail(
                    'GARDEN_STATE_INVALID',
                    409,
                    'Garden stack contains an invalid block identifier.',
                );
            }
            if (!blocks.has(blockId)) {
                fail(
                    'GARDEN_STATE_INVALID',
                    409,
                    'Garden stack references an unknown active block.',
                );
            }
            if (placedBlockIds.has(blockId)) {
                fail(
                    'GARDEN_STATE_INVALID',
                    409,
                    'Garden block appears in more than one stack position.',
                );
            }
            placedBlockIds.add(blockId);
            preparedBlockIds.push(blockId);
            if (blockId === input.block.id) {
                candidatePlacement = {
                    stack: {
                        blocks: preparedBlockIds,
                        positionX: stack.positionX,
                        positionY: stack.positionY,
                    },
                    stackIndex,
                };
            }
        }

        const preparedStack = {
            blocks: preparedBlockIds,
            positionX: stack.positionX,
            positionY: stack.positionY,
        };
        stacks.set(key, preparedStack);
        if (
            candidatePlacement?.stack.positionX === stack.positionX &&
            candidatePlacement.stack.positionY === stack.positionY
        ) {
            candidatePlacement = {
                stack: preparedStack,
                stackIndex: candidatePlacement.stackIndex,
            };
        }
    }

    if (!candidatePlacement) {
        fail(
            'GARDEN_STATE_INVALID',
            409,
            'Rotated garden block is not placed in the garden.',
        );
    }
    return { candidatePlacement, stacks };
}

function assertAuthoritativeCandidate(
    input: ValidateRotatedBlockPlacementInput,
    blocks: ReadonlyMap<string, PreparedBlock>,
    candidatePlacement: Readonly<{
        stack: PreparedStack;
        stackIndex: number;
    }>,
) {
    if (
        input.candidateRotation !== null &&
        !isStorageInteger(input.candidateRotation)
    ) {
        fail('INVALID_REQUEST', 400, 'Garden block rotation is invalid.');
    }
    const authoritativeBlock = blocks.get(input.block.id);
    if (
        !authoritativeBlock ||
        authoritativeBlock.name !== input.block.name ||
        authoritativeBlock.rotation !== input.block.rotation
    ) {
        fail(
            'GARDEN_STATE_CHANGED',
            409,
            'Garden block changed while validating its rotation.',
        );
    }
    if (
        !isStorageInteger(input.placement.stackIndex) ||
        input.placement.stackIndex < 0 ||
        input.placement.stack.positionX !==
            candidatePlacement.stack.positionX ||
        input.placement.stack.positionY !==
            candidatePlacement.stack.positionY ||
        input.placement.stackIndex !== candidatePlacement.stackIndex ||
        !equalBlockIds(
            input.placement.stack.blocks,
            candidatePlacement.stack.blocks,
        ) ||
        candidatePlacement.stack.blocks[candidatePlacement.stackIndex] !==
            input.block.id
    ) {
        fail(
            'GARDEN_STATE_CHANGED',
            409,
            'Garden block placement changed while validating its rotation.',
        );
    }
}

function createBlockGeometry(
    input: ValidateRotatedBlockPlacementInput,
    blocks: ReadonlyMap<string, PreparedBlock>,
    stacks: ReadonlyMap<string, PreparedStack>,
    catalog: ReadonlyMap<string, CatalogBlock>,
) {
    const geometries: BlockGeometry[] = [];
    let order = 0;
    for (const stack of stacks.values()) {
        let stackHeight = 0;
        let supportBlock: PreparedBlock | undefined;
        for (const [stackIndex, blockId] of stack.blocks.entries()) {
            const block = blocks.get(blockId);
            if (!block) {
                fail(
                    'GARDEN_STATE_INVALID',
                    409,
                    'Garden stack changed during rotation validation.',
                );
            }
            const catalogBlock = catalog.get(block.name);
            if (!catalogBlock) {
                fail(
                    'BLOCK_DIRECTORY_DATA_NOT_FOUND',
                    404,
                    'Directory data for an active garden block was not found.',
                );
            }
            if (!supportBlock && requiresWaterOrSwampSupport(block.name)) {
                fail(
                    'GARDEN_STATE_INVALID',
                    409,
                    'A garden block is missing required water or swamp support.',
                );
            }
            if (supportBlock) {
                const supportCatalogBlock = catalog.get(supportBlock.name);
                if (
                    !supportCatalogBlock ||
                    !canStackBlockOnBlock({
                        aboveBlockData: catalogBlock.data,
                        aboveBlockName: block.name,
                        belowBlockData: supportCatalogBlock.data,
                        belowBlockName: supportBlock.name,
                    })
                ) {
                    fail(
                        'GARDEN_STATE_INVALID',
                        409,
                        'Garden stack order contains incompatible blocks.',
                    );
                }
            }

            const bottomHeight = stackHeight;
            const blockHeight = getEffectiveGardenStackBlockHeight({
                blockHeight: catalogBlock.height,
                blockName: block.name,
                supportBlockName: supportBlock?.name,
            });
            if (!Number.isFinite(blockHeight) || blockHeight < 0) {
                fail(
                    'BLOCK_DIRECTORY_UNAVAILABLE',
                    503,
                    'Garden block directory produced an invalid height.',
                );
            }
            const topHeight = bottomHeight + blockHeight;
            const rotation =
                block.id === input.block.id
                    ? (input.candidateRotation ?? 0)
                    : (block.rotation ?? 0);
            const cells = getGardenBlockFootprintOffsets(
                catalogBlock.data,
                rotation,
            ).map((offset) => ({
                x: stack.positionX + offset.x,
                y: stack.positionY + offset.y,
            }));
            if (
                cells.some(
                    (cell) =>
                        !isStorageInteger(cell.x) || !isStorageInteger(cell.y),
                )
            ) {
                fail(
                    'GARDEN_STATE_INVALID',
                    409,
                    'Garden block footprint exceeds storage coordinates.',
                );
            }
            geometries.push({
                block,
                bottomHeight,
                cells,
                data: catalogBlock.data,
                order,
                stackIndex,
                topHeight,
            });
            order += 1;
            stackHeight = topHeight;
            supportBlock = block;
        }
    }
    return geometries;
}

function intervalsOverlap(left: BlockGeometry, right: BlockGeometry) {
    if (
        left.topHeight - left.bottomHeight <= heightTolerance ||
        right.topHeight - right.bottomHeight <= heightTolerance
    ) {
        return false;
    }
    return (
        Math.max(left.bottomHeight, right.bottomHeight) <
        Math.min(left.topHeight, right.topHeight) - heightTolerance
    );
}

function geometriesByCell(geometries: readonly BlockGeometry[]) {
    const byCell = new Map<string, BlockGeometry[]>();
    for (const geometry of geometries) {
        for (const cell of geometry.cells) {
            const key = coordinateKey(cell);
            const existing = byCell.get(key);
            if (existing) {
                existing.push(geometry);
            } else {
                byCell.set(key, [geometry]);
            }
        }
    }
    return byCell;
}

function assertNoGeometryOverlap(
    byCell: ReadonlyMap<string, readonly BlockGeometry[]>,
) {
    for (const cellGeometries of byCell.values()) {
        for (
            let leftIndex = 0;
            leftIndex < cellGeometries.length;
            leftIndex++
        ) {
            const left = cellGeometries[leftIndex];
            if (!left) continue;
            for (
                let rightIndex = leftIndex + 1;
                rightIndex < cellGeometries.length;
                rightIndex++
            ) {
                const right = cellGeometries[rightIndex];
                if (right && intervalsOverlap(left, right)) {
                    fail(
                        'GARDEN_STATE_INVALID',
                        409,
                        'Rotated garden block footprint overlaps another block.',
                    );
                }
            }
        }
    }
}

function topSupportAtHeight(
    candidates: readonly BlockGeometry[],
    geometry: BlockGeometry,
) {
    return candidates
        .filter(
            (candidate) =>
                candidate.block.id !== geometry.block.id &&
                candidate.topHeight <= geometry.bottomHeight + heightTolerance,
        )
        .sort((left, right) => {
            if (left.topHeight !== right.topHeight) {
                return right.topHeight - left.topHeight;
            }
            if (left.bottomHeight !== right.bottomHeight) {
                return right.bottomHeight - left.bottomHeight;
            }
            if (left.stackIndex !== right.stackIndex) {
                return right.stackIndex - left.stackIndex;
            }
            return right.order - left.order;
        })[0];
}

function assertLevelCompatibleSupport(
    geometries: readonly BlockGeometry[],
    byCell: ReadonlyMap<string, readonly BlockGeometry[]>,
) {
    for (const geometry of geometries) {
        for (const cell of geometry.cells) {
            const support = topSupportAtHeight(
                byCell.get(coordinateKey(cell)) ?? [],
                geometry,
            );
            const supportHeight = support?.topHeight ?? 0;
            if (
                Math.abs(supportHeight - geometry.bottomHeight) >
                heightTolerance
            ) {
                fail(
                    'GARDEN_STATE_INVALID',
                    409,
                    'Garden block footprint has missing or uneven support.',
                );
            }
            if (!support) {
                if (requiresWaterOrSwampSupport(geometry.block.name)) {
                    fail(
                        'GARDEN_STATE_INVALID',
                        409,
                        'Garden block requires water or swamp below every footprint cell.',
                    );
                }
                continue;
            }
            if (
                !canStackBlockOnBlock({
                    aboveBlockData: geometry.data,
                    aboveBlockName: geometry.block.name,
                    belowBlockData: support.data,
                    belowBlockName: support.block.name,
                })
            ) {
                fail(
                    'GARDEN_STATE_INVALID',
                    409,
                    'Garden block footprint has incompatible support.',
                );
            }
            if (
                requiresWaterOrSwampSupport(geometry.block.name) &&
                !isWaterOrSwampBlockName(support.block.name)
            ) {
                fail(
                    'GARDEN_STATE_INVALID',
                    409,
                    'Garden block requires water or swamp below every footprint cell.',
                );
            }
        }
    }
}

function validateRotation(
    input: ValidateRotatedBlockPlacementInput,
): ValidateRotatedBlockPlacementResult {
    const catalog = prepareCatalog(input.blockData);
    const blocks = prepareBlocks(input.snapshot, catalog);
    const { candidatePlacement, stacks } = prepareStacks(input, blocks);
    assertAuthoritativeCandidate(input, blocks, candidatePlacement);
    const geometries = createBlockGeometry(input, blocks, stacks, catalog);
    const byCell = geometriesByCell(geometries);
    assertNoGeometryOverlap(byCell);
    assertLevelCompatibleSupport(geometries, byCell);
    return { valid: true };
}

export async function validateRotatedBlockPlacement(
    input: ValidateRotatedBlockPlacementInput,
): Promise<ValidateRotatedBlockPlacementResult> {
    try {
        return validateRotation(input);
    } catch (error) {
        if (error instanceof RotatedBlockPlacementError) {
            return {
                valid: false,
                code: error.code,
                error: error.message,
                status: error.status,
            };
        }
        throw error;
    }
}
