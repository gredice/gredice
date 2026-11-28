import { isAppearanceVariantEntityName } from '../entityAppearanceVariants';
import {
    type GardenBlockDataLike,
    type GardenBlockGridPosition,
    type GardenBlockLevel,
    type GardenBlockPlacementValidator,
    type GardenBlockQuarterTurns,
    getGardenBlockSpan,
    normalizeGardenBlockRotation,
} from '../gardenBlocks';
import { woodenSignBlockName } from '../woodenSign';

/**
 * Server limits for one Expand batch, shared by the client and the API:
 * at most `maxPlacements` new blocks whose positions fit in a
 * `maxSide` × `maxSide` bounding box.
 */
export const gardenBlockExpansionLimits = {
    maxSide: 10,
    maxPlacements: 100,
} as const;

export type GardenBlockExpansionLimits = {
    maxSide: number;
    maxPlacements: number;
};

/**
 * Client corner clamp per side (OPEN-1). Instanced block types add one
 * instance per copy; every other type mounts a full entity per copy, so it
 * gets a smaller rectangle. Both stay within `gardenBlockExpansionLimits`.
 */
export const gardenBlockExpansionClientMaxSide = {
    instanced: gardenBlockExpansionLimits.maxSide,
    other: 5,
} as const;

export function getGardenBlockExpansionClientMaxSide(input: {
    instanced: boolean;
}) {
    return input.instanced
        ? gardenBlockExpansionClientMaxSide.instanced
        : gardenBlockExpansionClientMaxSide.other;
}

const RAISED_BED_BLOCK_NAME = 'Raised_Bed';
const GARDEN_BOX_BLOCK_NAME = 'GardenBox';
const GIFT_BOX_BLOCK_NAME = 'GiftBox';
const GIFT_BOX_BLOCK_NAME_PREFIX = `${GIFT_BOX_BLOCK_NAME}_`;

/**
 * Animals and blocks that spawn an animal. Copying them would spawn a herd
 * (a 10 × 10 of ChickenCoop is 99 chickens; BirdHouse adds one bird per
 * block with no cap). Appearance-variant entities
 * (`isAppearanceVariantEntityName`) are excluded as well.
 *
 * `packages/game` keeps its own lists of animal homes (persistent pet homes,
 * fauna habitats that act as homes such as BirdHouse, and the hedgehog
 * habitat resolver); a drift test there checks that each one is in this set
 * or is ineligible for another reason.
 */
export const gardenAnimalBlockNames: ReadonlySet<string> = new Set([
    // Animals
    'Cow',
    'Horse',
    'Goat',
    'Rabbit',
    'Sheep',
    'Ladybug',
    // Homes that spawn an animal
    'RabbitHutch',
    'HorseStable',
    'CowShelter',
    'GoatShelter',
    'SheepFold',
    'ChickenCoop',
    'PigletPen',
    'DogHouse',
    'CatPillow',
    'Cat_Pillow',
    'BirdHouse',
    'HedgehogShelter',
]);

export function isGardenAnimalBlockName(blockName: string) {
    return (
        gardenAnimalBlockNames.has(blockName) ||
        isAppearanceVariantEntityName(blockName)
    );
}

export type GardenBlockExpansionIneligibleReason =
    | 'multi-cell'
    | 'raised-bed'
    | 'garden-box'
    | 'gift-box'
    | 'animal'
    | 'per-block-content'
    | 'unknown-block';

export type GardenBlockExpansionEligibility =
    | { eligible: true }
    | { eligible: false; reason: GardenBlockExpansionIneligibleReason };

function getExcludedBlockNameReason(
    blockName: string,
): GardenBlockExpansionIneligibleReason | null {
    if (blockName === RAISED_BED_BLOCK_NAME) {
        return 'raised-bed';
    }

    if (blockName === GARDEN_BOX_BLOCK_NAME) {
        return 'garden-box';
    }

    if (
        blockName === GIFT_BOX_BLOCK_NAME ||
        blockName.startsWith(GIFT_BOX_BLOCK_NAME_PREFIX)
    ) {
        return 'gift-box';
    }

    if (isGardenAnimalBlockName(blockName)) {
        return 'animal';
    }

    if (blockName === woodenSignBlockName) {
        return 'per-block-content';
    }

    return null;
}

/**
 * Whether a placed block can be expanded (OPEN-2, OPEN-3). Name-based
 * exclusions are checked first so the reason stays specific (an animal home
 * is `animal`, not `multi-cell`); then missing block data; then the
 * footprint, which must be one cell at the block's rotation.
 *
 * Price, night-only sales and balance are not checked here.
 */
export function getGardenBlockExpansionEligibility(input: {
    blockName: string;
    blockData: GardenBlockDataLike | null | undefined;
    rotation?: number | null;
}): GardenBlockExpansionEligibility {
    const excludedReason = getExcludedBlockNameReason(input.blockName);
    if (excludedReason) {
        return { eligible: false, reason: excludedReason };
    }

    if (!input.blockData) {
        return { eligible: false, reason: 'unknown-block' };
    }

    const span = getGardenBlockSpan(
        input.blockData,
        normalizeGardenBlockRotation(input.rotation),
    );
    if (span.width !== 1 || span.depth !== 1) {
        return { eligible: false, reason: 'multi-cell' };
    }

    return { eligible: true };
}

function clampAxis(source: number, corner: number, reach: number) {
    if (!Number.isFinite(corner)) {
        return source;
    }

    return Math.min(
        source + reach,
        Math.max(source - reach, Math.round(corner)),
    );
}

/**
 * Keeps the dragged corner within `maxSide` cells of the source on each axis
 * (`|cx − sx| ≤ maxSide − 1`), so the rectangle is at most
 * `maxSide` × `maxSide`. The rectangle can grow in any direction.
 */
export function clampGardenBlockExpansionCorner(
    source: GardenBlockGridPosition,
    corner: GardenBlockGridPosition,
    maxSide: number,
): GardenBlockGridPosition {
    const reach = Number.isFinite(maxSide)
        ? Math.max(0, Math.floor(maxSide) - 1)
        : 0;

    return {
        x: clampAxis(source.x, corner.x, reach),
        y: clampAxis(source.y, corner.y, reach),
    };
}

export type GardenBlockExpansionBounds = {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    depth: number;
};

/** The rectangle spanned by two cells, both included. */
export function getGardenBlockExpansionBounds(
    source: GardenBlockGridPosition,
    corner: GardenBlockGridPosition,
): GardenBlockExpansionBounds {
    const minX = Math.min(source.x, corner.x);
    const maxX = Math.max(source.x, corner.x);
    const minY = Math.min(source.y, corner.y);
    const maxY = Math.max(source.y, corner.y);

    return {
        minX,
        maxX,
        minY,
        maxY,
        width: maxX - minX + 1,
        depth: maxY - minY + 1,
    };
}

export type GardenBlockExpansionCellStatus =
    | 'source'
    | 'place'
    | 'occupied'
    | 'other-level'
    | 'invalid'
    | 'pending';

export type GardenBlockExpansionCell = GardenBlockGridPosition & {
    status: GardenBlockExpansionCellStatus;
};

export type GardenBlockExpansionPlacement = {
    position: GardenBlockGridPosition;
    /** The cell's stack before the copy is added; sent to the server as is. */
    expectedExistingBlocks: string[];
};

/**
 * The source block's level, read from the validator's snapshot. Copies
 * stand on `baseHeight` and must end at `topHeight`.
 */
export type GardenBlockExpansionSource = {
    /** The surface the source stands on. */
    baseHeight: number;
    /** The source's top surface (equal to the base for collapsed water). */
    topHeight: number;
    /** The block directly under the source in its stack; null on bare ground. */
    support: GardenBlockLevel | null;
};

/**
 * Finds the source block in its own stack. Returns null when the stack at
 * `position` has no block `blockId`, or that block is not of the
 * validator's `blockName`.
 */
export function getGardenBlockExpansionSource(input: {
    validator: GardenBlockPlacementValidator;
    /** The source cell; `y` is the garden's depth axis (world z). */
    position: GardenBlockGridPosition;
    blockId: string;
}): GardenBlockExpansionSource | null {
    const levels = input.validator.getStackBlockLevels(input.position);
    const index = levels.findIndex((level) => level.blockId === input.blockId);
    const level = levels[index];
    if (!level || level.blockName !== input.validator.blockName) {
        return null;
    }

    return {
        baseHeight: level.baseHeight,
        topHeight: level.topHeight,
        support: levels[index - 1] ?? null,
    };
}

export type GardenBlockExpansionPlan = {
    /** The source block's rotation as quarter turns; copies use it. */
    rotation: GardenBlockQuarterTurns;
    /**
     * The source's level; null when the source block is not in the
     * validator's snapshot, and then every other cell is `invalid`.
     */
    source: GardenBlockExpansionSource | null;
    bounds: GardenBlockExpansionBounds;
    /** Every cell of the rectangle, source included, by row (y, then x). */
    cells: GardenBlockExpansionCell[];
    /** Cells that get a copy: by distance from the source, then y, then x. */
    placements: GardenBlockExpansionPlacement[];
    /** Cells other than the source that get no copy. */
    skippedCount: number;
};

/** Surfaces closer than this are on the same level. */
const SAME_LEVEL_EPSILON = 1e-4;
/** Stands in for a copy when the planner measures where it would end. */
const EXPANSION_COPY_BLOCK_ID = '__garden_block_expansion_copy__';

function compareLevels(left: number, right: number) {
    if (left > right + SAME_LEVEL_EPSILON) {
        return 1;
    }

    return left < right - SAME_LEVEL_EPSILON ? -1 : 0;
}

function classifyExpansionCell(params: {
    position: GardenBlockGridPosition;
    rotation: GardenBlockQuarterTurns;
    source: GardenBlockExpansionSource;
    validator: GardenBlockPlacementValidator;
    isPendingBlockId?: (blockId: string) => boolean;
}):
    | { status: Exclude<GardenBlockExpansionCellStatus, 'place' | 'source'> }
    | { status: 'place'; expectedExistingBlocks: string[] } {
    const { position, rotation, source, validator, isPendingBlockId } = params;
    const stackBlockIds = validator.getStackBlockIds(position);

    if (isPendingBlockId && stackBlockIds.some(isPendingBlockId)) {
        return { status: 'pending' };
    }

    const topComparison = compareLevels(
        validator.getCellTopHeight(position),
        source.baseHeight,
    );
    if (topComparison > 0) {
        return { status: 'occupied' };
    }

    if (topComparison < 0) {
        return { status: 'other-level' };
    }

    // OPEN-5: same height and same kind of support. A block standing on
    // another block only fills cells that have a block; one on bare ground
    // only fills empty cells.
    const cellHasSupport = !validator.isCellEmpty(position);
    if (cellHasSupport !== (source.support !== null)) {
        return { status: 'other-level' };
    }

    // The block the copy would stand on must sit where the source's support
    // sits. Blocks with no height, and water collapsed on a shore piece, do
    // not raise the cell's top, so the height test alone misses them: a
    // higher base means such a block already fills the source's level (for
    // example the same shore water); a lower base is another support.
    const cellTopBlock = validator.getCellTopBlock(position);
    if (source.support && cellTopBlock) {
        const supportComparison = compareLevels(
            cellTopBlock.baseHeight,
            source.support.baseHeight,
        );
        if (supportComparison > 0) {
            return { status: 'occupied' };
        }

        if (supportComparison < 0) {
            return { status: 'other-level' };
        }
    }

    const validation = validator.validate(position, rotation);
    if (!validation.valid) {
        return { status: 'invalid' };
    }

    // The copy must end where the source ends. Water collapses only on edge
    // and corner terrain, so a copy of shore water on flat ground would
    // stand a block higher than the source.
    const copyTopHeight = validator
        .withPlacedBlock({
            position,
            blockId: EXPANSION_COPY_BLOCK_ID,
            rotation,
        })
        .getCellTopHeight(position);
    if (compareLevels(copyTopHeight, source.topHeight) !== 0) {
        return { status: 'other-level' };
    }

    return {
        status: 'place',
        expectedExistingBlocks: validation.placement.existingBlocks.slice(),
    };
}

function chebyshevDistance(
    left: GardenBlockGridPosition,
    right: GardenBlockGridPosition,
) {
    return Math.max(Math.abs(left.x - right.x), Math.abs(left.y - right.y));
}

/**
 * Classifies every cell of the rectangle between `source` and `corner` for
 * copies of a one-cell block (see `getGardenBlockExpansionEligibility`).
 * The source's level comes from the validator's snapshot
 * (`getGardenBlockExpansionSource`). First match wins for each cell other
 * than the source:
 *
 * 1. the stack holds a pending (unsaved) block → `pending`;
 * 2. the cell's top surface is above the source's base → `occupied`
 *    (includes blocks anchored on a neighbouring cell);
 * 3. the top surface is below the source's base → `other-level`;
 * 4. the support kind differs (source on a block vs an empty cell, or source
 *    on bare ground vs a cell with a block) → `other-level`;
 * 5. the cell's top block (`getCellTopBlock`) stands higher than the
 *    source's support → `occupied` (a block with no height or collapsed
 *    water already fills that level), or lower → `other-level`;
 * 6. the shared placement rules reject the cell → `invalid`;
 * 7. the copy would end above or below the source's top (water collapses
 *    only on edge and corner terrain) → `other-level`;
 * 8. otherwise → `place`.
 *
 * Cells are checked against the validator's snapshot only; copies do not
 * affect each other because each covers one cell. The corner is clamped to
 * `maxSide` (default `gardenBlockExpansionLimits.maxSide`). When the source
 * block is not in the snapshot, every other cell is `invalid`.
 */
export function planGardenBlockExpansion(input: {
    blockName: string;
    rotation: number | null | undefined;
    /** Source cell; `y` is the garden's depth axis (world z). */
    source: GardenBlockGridPosition;
    /** The placed block being expanded, in the stack at `source`. */
    sourceBlockId: string;
    corner: GardenBlockGridPosition;
    /** Built for `blockName` from the same garden as the source. */
    validator: GardenBlockPlacementValidator;
    /** Client: `(id) => id.startsWith('optimistic-')`. */
    isPendingBlockId?: (blockId: string) => boolean;
    maxSide?: number;
}): GardenBlockExpansionPlan {
    const { source, validator } = input;
    const rotation = normalizeGardenBlockRotation(input.rotation);
    const sourceLevel =
        validator.blockName === input.blockName
            ? getGardenBlockExpansionSource({
                  validator,
                  position: source,
                  blockId: input.sourceBlockId,
              })
            : null;
    const corner = clampGardenBlockExpansionCorner(
        source,
        input.corner,
        Math.min(
            input.maxSide ?? gardenBlockExpansionLimits.maxSide,
            gardenBlockExpansionLimits.maxSide,
        ),
    );
    const bounds = getGardenBlockExpansionBounds(source, corner);
    const cells: GardenBlockExpansionCell[] = [];
    const placements: GardenBlockExpansionPlacement[] = [];

    for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let x = bounds.minX; x <= bounds.maxX; x++) {
            if (x === source.x && y === source.y) {
                cells.push({ x, y, status: 'source' });
                continue;
            }

            if (!sourceLevel) {
                cells.push({ x, y, status: 'invalid' });
                continue;
            }

            const classification = classifyExpansionCell({
                position: { x, y },
                rotation,
                source: sourceLevel,
                validator,
                isPendingBlockId: input.isPendingBlockId,
            });
            cells.push({ x, y, status: classification.status });
            if (classification.status === 'place') {
                placements.push({
                    position: { x, y },
                    expectedExistingBlocks:
                        classification.expectedExistingBlocks,
                });
            }
        }
    }

    placements.sort(
        (left, right) =>
            chebyshevDistance(left.position, source) -
                chebyshevDistance(right.position, source) ||
            left.position.y - right.position.y ||
            left.position.x - right.position.x,
    );

    return {
        rotation,
        source: sourceLevel,
        bounds,
        cells,
        placements,
        skippedCount: cells.length - 1 - placements.length,
    };
}

export type GardenBlockBatchPlacementInput = {
    position: GardenBlockGridPosition;
    expectedExistingBlocks: readonly string[];
};

export type GardenBlockBatchPlacementConflictReason =
    | 'duplicate'
    | 'stack-changed'
    | 'invalid-placement';

export type GardenBlockBatchPlacementConflict = {
    index: number;
    reason: GardenBlockBatchPlacementConflictReason;
};

export type GardenBlockBatchPlacementCheck =
    | { ok: true }
    | { ok: false; reason: 'area-too-large' }
    | { ok: false; conflicts: GardenBlockBatchPlacementConflict[] };

const BATCH_PLACEHOLDER_BLOCK_ID_PREFIX = '__garden_block_batch_candidate__:';

function isGridCoordinate(value: number) {
    return Number.isSafeInteger(value);
}

function sameBlockIds(left: readonly string[], right: readonly string[]) {
    return (
        left.length === right.length &&
        left.every((blockId, index) => blockId === right[index])
    );
}

function exceedsExpansionArea(
    placements: readonly GardenBlockBatchPlacementInput[],
    limits: GardenBlockExpansionLimits,
) {
    if (placements.length > limits.maxPlacements) {
        return true;
    }

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const { position } of placements) {
        // Malformed coordinates are reported per placement instead.
        if (!isGridCoordinate(position.x) || !isGridCoordinate(position.y)) {
            continue;
        }

        minX = Math.min(minX, position.x);
        maxX = Math.max(maxX, position.x);
        minY = Math.min(minY, position.y);
        maxY = Math.max(maxY, position.y);
    }

    if (minX > maxX || minY > maxY) {
        return false;
    }

    return maxX - minX + 1 > limits.maxSide || maxY - minY + 1 > limits.maxSide;
}

/**
 * Server-side check of one Expand batch against a locked garden snapshot.
 *
 * 1. More than `limits.maxPlacements` placements, or a bounding box wider or
 *    deeper than `limits.maxSide` → `area-too-large` (whole request).
 * 2. Per placement, in request order, first match wins: a position already
 *    used by an earlier placement → `duplicate`; `expectedExistingBlocks`
 *    not exactly the snapshot's stack (same ids, same order) →
 *    `stack-changed`; the shared placement rules reject it at the
 *    normalized rotation → `invalid-placement`.
 *
 * Each accepted placement adds a placeholder block to the validator before
 * the next is checked, so multi-cell copies could not overlap. The same-level
 * and support-kind rules of the planner are presentation and are not
 * enforced here. An empty list is `ok`; the request schema requires at least
 * one placement.
 */
export function validateGardenBlockBatchPlacements(input: {
    blockName: string;
    rotation: number | null | undefined;
    placements: readonly GardenBlockBatchPlacementInput[];
    /** Built from the snapshot for `blockName`. */
    validator: GardenBlockPlacementValidator;
    limits?: GardenBlockExpansionLimits;
}): GardenBlockBatchPlacementCheck {
    const { blockName, placements } = input;
    const limits = input.limits ?? gardenBlockExpansionLimits;
    if (exceedsExpansionArea(placements, limits)) {
        return { ok: false, reason: 'area-too-large' };
    }

    if (input.validator.blockName !== blockName) {
        throw new Error(
            `Garden block batch validator is for ${input.validator.blockName}, not ${blockName}`,
        );
    }

    const rotation = normalizeGardenBlockRotation(input.rotation);
    const snapshot = input.validator;
    let validator = input.validator;
    const usedCells = new Set<string>();
    const conflicts: GardenBlockBatchPlacementConflict[] = [];

    placements.forEach(({ position, expectedExistingBlocks }, index) => {
        if (!isGridCoordinate(position.x) || !isGridCoordinate(position.y)) {
            conflicts.push({ index, reason: 'invalid-placement' });
            return;
        }

        const key = `${position.x}|${position.y}`;
        if (usedCells.has(key)) {
            conflicts.push({ index, reason: 'duplicate' });
            return;
        }
        usedCells.add(key);

        if (
            !sameBlockIds(
                snapshot.getStackBlockIds(position),
                expectedExistingBlocks,
            )
        ) {
            conflicts.push({ index, reason: 'stack-changed' });
            return;
        }

        if (!validator.validate(position, rotation).valid) {
            conflicts.push({ index, reason: 'invalid-placement' });
            return;
        }

        validator = validator.withPlacedBlock({
            position,
            blockId: `${BATCH_PLACEHOLDER_BLOCK_ID_PREFIX}${index}`,
            rotation,
        });
    });

    return conflicts.length > 0 ? { ok: false, conflicts } : { ok: true };
}
