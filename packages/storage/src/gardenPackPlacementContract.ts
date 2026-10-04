import { z } from 'zod';
import { gardenPackProductSnapshotSchema } from './gardenPackContract';

export const gardenPackFixedVariantSchema =
    gardenPackProductSnapshotSchema.shape.lines.element.shape.variant;
export const gardenPackPlacementBodySchema = z.strictObject({
    gardenId: z.number().int().positive().max(2_147_483_647),
    operationId: z
        .string()
        .min(1)
        .max(96)
        .refine((value) => value.trim() === value),
    position: z.strictObject({
        x: z.number().int().min(-2_147_483_648).max(2_147_483_647),
        y: z.number().int().min(-2_147_483_648).max(2_147_483_647),
    }),
    expectedExistingBlocks: z.array(z.string().min(1).max(128)).max(128),
    variant: gardenPackFixedVariantSchema,
});
export const gardenPackPlacementIdentitySchema = z.strictObject({
    purchaseId: z.string().uuid(),
    lineId: z.string().min(1).max(100),
    unitOrdinal: z.coerce.number().int().min(1).max(1000),
});
export const gardenPackPlacementCommandSchema =
    gardenPackPlacementBodySchema.extend({
        ...gardenPackPlacementIdentitySchema.shape,
        accountId: z.string().min(1).max(128),
    });
export const gardenPackPlacementResponseSchema = z.strictObject({
    blockId: z.string().min(1).max(128),
    variant: z.number().int().nonnegative().nullable(),
    position: gardenPackPlacementBodySchema.shape.position,
});
export type GardenPackPlacementCommand = z.infer<
    typeof gardenPackPlacementCommandSchema
>;
export type GardenPackPlacementResponse = z.infer<
    typeof gardenPackPlacementResponseSchema
>;
