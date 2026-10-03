import { z } from 'zod';
import {
    gardenPackFixedVariantSchema,
    gardenPackPlacementBodySchema,
    gardenPackPlacementResponseSchema,
} from './gardenPackPlacementContract';

const id = z.string().min(1).max(100);
const rotation = z.number().int().min(0).max(3);
export const gardenPackLayoutSchema = z.strictObject({
    id,
    versionId: id,
    name: z.record(z.string(), z.string()),
    placements: z
        .array(
            z.strictObject({
                slotId: id,
                lineId: id,
                entityId: id,
                modelName: id,
                variant: gardenPackFixedVariantSchema,
                offset: gardenPackPlacementBodySchema.shape.position,
                rotation,
                footprint: z.strictObject({
                    width: z.number().int().min(1).max(16),
                    depth: z.number().int().min(1).max(16),
                }),
            }),
        )
        .min(1)
        .max(32),
    availableUnits: z
        .array(
            z.strictObject({
                lineId: id,
                unitOrdinal: z.number().int().min(1).max(1000),
            }),
        )
        .max(1000),
});
export const gardenPackGroupPlacementBodySchema = z.strictObject({
    operationId: z.string().uuid(),
    expectedAccountId: z.string().uuid(),
    gardenId: gardenPackPlacementBodySchema.shape.gardenId,
    layoutVersionId: id,
    anchor: gardenPackPlacementBodySchema.shape.position,
    rotation,
    units: z
        .array(
            z.strictObject({
                slotId: id,
                lineId: id,
                unitOrdinal: z.number().int().min(1).max(1000),
            }),
        )
        .min(1)
        .max(32),
    expectedStacks: z
        .array(
            z.strictObject({
                positionX: gardenPackPlacementBodySchema.shape.position.shape.x,
                positionY: gardenPackPlacementBodySchema.shape.position.shape.y,
                blocks: gardenPackPlacementBodySchema.shape
                    .expectedExistingBlocks,
            }),
        )
        .min(1)
        .max(512),
});
export const gardenPackGroupPlacementIdentitySchema = z.strictObject({
    purchaseId: z.string().uuid(),
    layoutId: id,
});
export const gardenPackGroupPlacementCommandSchema =
    gardenPackGroupPlacementBodySchema.extend({
        ...gardenPackGroupPlacementIdentitySchema.shape,
        accountId: z.string().uuid(),
    });
export const gardenPackGroupPlacementResponseSchema = z.strictObject({
    operationId: z.string().uuid(),
    purchaseId: z.string().uuid(),
    gardenId: gardenPackPlacementBodySchema.shape.gardenId,
    layoutId: id,
    layoutVersionId: id,
    chargedSunflowers: z.literal(0),
    placements: z
        .array(
            gardenPackPlacementResponseSchema.extend({
                slotId: id,
                lineId: id,
                unitOrdinal: z.number().int().min(1).max(1000),
                modelName: id,
                rotation,
                existingBlocks:
                    gardenPackPlacementBodySchema.shape.expectedExistingBlocks,
            }),
        )
        .min(1)
        .max(32),
});
export type GardenPackGroupPlacementBody = z.infer<
    typeof gardenPackGroupPlacementBodySchema
>;
export type GardenPackGroupPlacementCommand = z.infer<
    typeof gardenPackGroupPlacementCommandSchema
>;
export type GardenPackGroupPlacementResponse = z.infer<
    typeof gardenPackGroupPlacementResponseSchema
>;

export const gardenPackGroupPlacementPublicResponseSchema =
    gardenPackGroupPlacementResponseSchema.extend({ replayed: z.boolean() });
export const gardenPackLayoutsResponseSchema = z.strictObject({
    enabled: z.boolean(),
    accountId: z.string().uuid().nullable(),
    purchaseId: z.string().uuid(),
    layouts: z.array(gardenPackLayoutSchema).max(3),
});
