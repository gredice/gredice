import {
    type GardenBlockBatchPurchaseBody,
    GardenBlockBatchRequestError,
} from '@gredice/client';
import { normalizeGardenBlockRotation } from '@gredice/js/gardenBlocks';
import { blockExpandCopy, blockOptionsToolbarCopy } from '../blockOptionsCopy';

type BlockExpandPlacement = {
    position: { x: number; y: number };
    expectedExistingBlocks: readonly string[];
};

/**
 * The body of `POST /api/gardens/:gardenId/blocks/batch` for a confirmed
 * Expand plan. The rotation is normalized to 0–3, and sandbox gardens send
 * `expectedUnitPrice: 0` (the server requires it there).
 */
export function buildBlockExpandRequestBody({
    blockName,
    isSandbox,
    operationId,
    placements,
    rotation,
    unitPrice,
}: {
    blockName: string;
    isSandbox: boolean;
    /** A new UUID per Potvrdi; a retry sends the stored body unchanged. */
    operationId: string;
    placements: readonly BlockExpandPlacement[];
    rotation: number | null | undefined;
    /** The directory price the player saw. */
    unitPrice: number;
}): GardenBlockBatchPurchaseBody {
    return {
        operationId,
        blockName,
        rotation: normalizeGardenBlockRotation(rotation),
        expectedUnitPrice: isSandbox ? 0 : unitPrice,
        placements: placements.map((placement) => ({
            position: { x: placement.position.x, y: placement.position.y },
            expectedExistingBlocks: [...placement.expectedExistingBlocks],
        })),
    };
}

/** Same cells in the same order, each planned against the same stack. */
export function blockExpandPlacementsEqual(
    left: readonly BlockExpandPlacement[],
    right: readonly BlockExpandPlacement[],
) {
    return (
        left.length === right.length &&
        left.every((placement, index) => {
            const other = right[index];
            return (
                other !== undefined &&
                placement.position.x === other.position.x &&
                placement.position.y === other.position.y &&
                placement.expectedExistingBlocks.length ===
                    other.expectedExistingBlocks.length &&
                placement.expectedExistingBlocks.every(
                    (blockId, blockIndex) =>
                        other.expectedExistingBlocks[blockIndex] === blockId,
                )
            );
        })
    );
}

/**
 * The garden cache changed between Potvrdi and sending, so the confirmed
 * plan no longer matches it. Nothing was sent; the bar shows the new plan.
 */
export class BlockExpandPlanChangedError extends Error {
    override readonly name = 'BlockExpandPlanChangedError';

    constructor() {
        super('Expand plan changed before the batch was sent');
    }
}

/** `game_block_expand_completed` outcomes. */
export type BlockExpandOutcome =
    | 'placed'
    | 'replayed'
    | 'conflict'
    | 'price_changed'
    | 'insufficient'
    | 'unavailable'
    | 'rate_limited'
    | 'uncertain'
    | 'failed';

export type BlockExpandFailure = {
    outcome: Exclude<BlockExpandOutcome, 'placed' | 'replayed'>;
    /** Croatian text for the bar's alert line. */
    message: string;
    /**
     * The server may have applied the batch (network failure, session,
     * timeout, server error). Keep the pending command and offer the same
     * request again; the server replays it without a second debit.
     */
    uncertain: boolean;
    /** Queries that must be refreshed. */
    refresh: { garden: boolean; account: boolean; blockData: boolean };
    /**
     * The block's current price from a `PRICE_CHANGED` answer, to put in
     * place of the cached directory price; null otherwise. The directory is
     * served from the browser's HTTP cache for up to an hour, so a refetch
     * could bring back the old price and every confirm would fail again.
     */
    unitPrice: number | null;
};

function failure(
    outcome: BlockExpandFailure['outcome'],
    message: string,
    refresh: Partial<BlockExpandFailure['refresh']> = {},
    unitPrice: number | null = null,
): BlockExpandFailure {
    return {
        outcome,
        message,
        uncertain: outcome === 'uncertain',
        refresh: {
            garden: refresh.garden ?? false,
            account: refresh.account ?? false,
            blockData: refresh.blockData ?? false,
        },
        unitPrice,
    };
}

function readServerUnitPrice(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
        ? value
        : null;
}

/**
 * What a failed Expand batch means for the player: the message, whether the
 * request is uncertain (keep it pending) or definitive (drop it), which
 * queries to refresh and, for a changed price, the server's price.
 */
export function resolveBlockExpandFailure(error: unknown): BlockExpandFailure {
    if (error instanceof BlockExpandPlanChangedError) {
        return failure('conflict', blockExpandCopy.gardenChanged);
    }
    if (!(error instanceof GardenBlockBatchRequestError)) {
        // Thrown before anything was sent (the client verifies receipts
        // and wraps network failures itself).
        return failure('failed', blockExpandCopy.failed);
    }
    if (error.uncertain) {
        return failure('uncertain', blockExpandCopy.uncertain, {
            garden: true,
            account: true,
        });
    }

    switch (error.code) {
        case 'GARDEN_STATE_CHANGED':
            return failure('conflict', blockExpandCopy.gardenChanged, {
                garden: true,
            });
        case 'PRICE_CHANGED': {
            // The server's price replaces the cached one; without it the
            // directory is refetched.
            const unitPrice = readServerUnitPrice(error.details.unitPrice);
            return failure(
                'price_changed',
                blockExpandCopy.priceChanged,
                { blockData: unitPrice === null },
                unitPrice,
            );
        }
        case 'INSUFFICIENT_SUNFLOWERS':
            // No count: the server's `affordableCount` comes from the raw
            // balance, while Expand counts the HUD balance (balance minus
            // the cart, OPEN-4). Once the account refreshes, the bar's
            // status line gives the count from that balance.
            return failure('insufficient', blockExpandCopy.short(0), {
                account: true,
            });
        case 'RATE_LIMITED':
            return failure('rate_limited', blockExpandCopy.rateLimited);
        case 'BLOCK_NOT_PURCHASABLE_NOW':
            return failure('unavailable', blockExpandCopy.nightOnly);
        case 'BLOCK_NOT_FOR_SALE':
            return failure('unavailable', blockExpandCopy.notForSale, {
                blockData: true,
            });
        case 'BLOCK_NOT_EXPANDABLE':
            return failure(
                'unavailable',
                blockOptionsToolbarCopy.disabledReasons.notExpandable,
            );
        case 'EXPANSION_AREA_TOO_LARGE':
            return failure('failed', blockExpandCopy.areaTooLarge);
        default:
            return failure('failed', blockExpandCopy.failed, {
                garden: true,
                account: true,
            });
    }
}

/**
 * The block catalogue with one block's sunflower price replaced, e.g. by
 * the price a `PRICE_CHANGED` answer carries. Other blocks keep their
 * objects; an unchanged catalogue is returned as is.
 */
export function withBlockSunflowerPrice<
    Block extends {
        information: { name: string };
        prices: { sunflowers?: number | null };
    },
>(
    blocks: Block[] | null | undefined,
    blockName: string,
    unitPrice: number,
): Block[] | null | undefined {
    if (
        !blocks?.some(
            (block) =>
                block.information.name === blockName &&
                block.prices.sunflowers !== unitPrice,
        )
    ) {
        return blocks;
    }

    return blocks.map((block) =>
        block.information.name === blockName
            ? { ...block, prices: { ...block.prices, sunflowers: unitPrice } }
            : block,
    );
}
