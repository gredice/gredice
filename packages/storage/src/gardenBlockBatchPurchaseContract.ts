import { gardenBlockExpansionLimits } from '@gredice/js/gardenBlockExpansion';
import { normalizeGardenBlockRotation } from '@gredice/js/gardenBlocks';
import { z } from 'zod';

/**
 * The server stores and returns `normalizeGardenBlockRotation(rotation)`
 * (0–3); re-exported so clients can compare receipts without another copy.
 */
export { gardenBlockExpansionLimits, normalizeGardenBlockRotation };

const postgresInt32Minimum = -2_147_483_648;
const postgresInt32Maximum = 2_147_483_647;

const int32 = z
    .number()
    .int()
    .min(postgresInt32Minimum)
    .max(postgresInt32Maximum);

const blockIdentifier = z
    .string()
    .min(1)
    .max(128)
    .refine((value) => value.trim() === value, {
        message: 'Identifiers must not have leading or trailing whitespace.',
    });

const position = z.strictObject({ x: int32, y: int32 });

/** The largest stack a placement may expect, as for single placement. */
export const gardenBlockBatchPurchaseMaxStackBlocks = 128;

/**
 * Request body of `POST /api/gardens/:gardenId/blocks/batch`. One command
 * buys `placements.length` copies of one block at the given cells, all or
 * nothing, for one debit of `expectedUnitPrice × placements.length`.
 *
 * - `operationId` is the idempotency key; a retry reuses it.
 * - `rotation` is any stored rotation; the server normalizes it to 0–3.
 * - `expectedUnitPrice` is the directory price the player saw; 0 in sandbox
 *   gardens. A different server price is rejected, never charged.
 * - `expectedExistingBlocks` is the stack at that cell the client planned
 *   against, in order.
 */
export const gardenBlockBatchPurchaseBodySchema = z
    .strictObject({
        operationId: z.uuid(),
        blockName: blockIdentifier,
        rotation: int32.nullable(),
        expectedUnitPrice: z
            .number()
            .int()
            .nonnegative()
            .max(postgresInt32Maximum),
        placements: z
            .array(
                z.strictObject({
                    position,
                    expectedExistingBlocks: z
                        .array(blockIdentifier)
                        .max(gardenBlockBatchPurchaseMaxStackBlocks),
                }),
            )
            .min(1)
            .max(gardenBlockExpansionLimits.maxPlacements),
    })
    .superRefine((body, context) => {
        const seen = new Set<string>();
        body.placements.forEach((placement, index) => {
            const key = `${placement.position.x.toString()}|${placement.position.y.toString()}`;
            if (seen.has(key)) {
                context.addIssue({
                    code: 'custom',
                    message: 'Placement positions must be unique.',
                    path: ['placements', index, 'position'],
                });
            }
            seen.add(key);
        });
    });

export const gardenBlockBatchPurchasePlacementResponseSchema = z.strictObject({
    id: blockIdentifier,
    position,
});

/** The receipt stored with the operation; replays return it unchanged. */
export const gardenBlockBatchPurchaseReceiptSchema = z.strictObject({
    operationId: z.uuid(),
    blockName: blockIdentifier,
    rotation: z.number().int().min(0).max(3),
    unitPrice: z.number().int().nonnegative(),
    chargedSunflowers: z.number().int().nonnegative(),
    placements: z
        .array(gardenBlockBatchPurchasePlacementResponseSchema)
        .min(1)
        .max(gardenBlockExpansionLimits.maxPlacements),
});

/** Successful response: the receipt plus whether it was a replay. */
export const gardenBlockBatchPurchaseResponseSchema =
    gardenBlockBatchPurchaseReceiptSchema.extend({
        replayed: z.boolean(),
    });

export const gardenBlockBatchPurchaseErrorCodes = [
    'INVALID_REQUEST',
    'EXPANSION_AREA_TOO_LARGE',
    'BLOCK_NOT_EXPANDABLE',
    'BLOCK_NOT_FOR_SALE',
    'BLOCK_NOT_PURCHASABLE_NOW',
    'INSUFFICIENT_SUNFLOWERS',
    'GARDEN_NOT_FOUND',
    'BLOCK_NOT_FOUND',
    'PRICE_CHANGED',
    'GARDEN_STATE_CHANGED',
    'OPERATION_CONFLICT',
    'RATE_LIMITED',
    'BLOCK_DIRECTORY_UNAVAILABLE',
    'OPERATION_FAILED',
] as const;
export type GardenBlockBatchPurchaseErrorCode =
    (typeof gardenBlockBatchPurchaseErrorCodes)[number];

export const gardenBlockBatchPurchaseConflictSchema = z.strictObject({
    index: z.number().int().nonnegative(),
    reason: z.enum(['duplicate', 'stack-changed', 'invalid-placement']),
});

/**
 * Error body: `{ code, error, ...details }`. `error` is English for logs;
 * clients show their own text for `code`. Detail fields by code:
 * `EXPANSION_AREA_TOO_LARGE` → `maxSide`, `maxPlacements`;
 * `BLOCK_NOT_EXPANDABLE` → `reason`;
 * `INSUFFICIENT_SUNFLOWERS` → `availableAmount`, `requiredAmount`,
 * `affordableCount`; `PRICE_CHANGED` → `unitPrice`;
 * `GARDEN_STATE_CHANGED` → `conflicts`; `RATE_LIMITED` → `retryAfterSeconds`
 * (also the `Retry-After` header); `INVALID_REQUEST` → `issues`.
 */
export const gardenBlockBatchPurchaseErrorSchema = z.object({
    code: z.string(),
    error: z.string(),
    maxSide: z.number().int().positive().optional(),
    maxPlacements: z.number().int().positive().optional(),
    reason: z.string().optional(),
    availableAmount: z.number().int().optional(),
    requiredAmount: z.number().int().nonnegative().optional(),
    affordableCount: z.number().int().nonnegative().optional(),
    unitPrice: z.number().int().nonnegative().optional(),
    conflicts: z.array(gardenBlockBatchPurchaseConflictSchema).optional(),
    retryAfterSeconds: z.number().int().positive().optional(),
});

export type GardenBlockBatchPurchaseBody = z.infer<
    typeof gardenBlockBatchPurchaseBodySchema
>;
export type GardenBlockBatchPurchaseReceipt = z.infer<
    typeof gardenBlockBatchPurchaseReceiptSchema
>;
export type GardenBlockBatchPurchaseResponse = z.infer<
    typeof gardenBlockBatchPurchaseResponseSchema
>;
export type GardenBlockBatchPurchaseConflict = z.infer<
    typeof gardenBlockBatchPurchaseConflictSchema
>;
export type GardenBlockBatchPurchaseError = z.infer<
    typeof gardenBlockBatchPurchaseErrorSchema
>;
