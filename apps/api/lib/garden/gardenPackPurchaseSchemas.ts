import { z } from 'zod';

const productId = z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);
export const gardenPackPurchaseBodySchema = z.strictObject({
    operationId: z.string().uuid(),
    expectedAccountId: z.string().uuid(),
    productId,
    quote: z.strictObject({
        productVersionId: productId,
        chargedSunflowers: z.number().int().min(1).max(2_147_483_647),
        currency: z.literal('sunflower'),
    }),
});
export type GardenPackPurchaseBody = z.infer<
    typeof gardenPackPurchaseBodySchema
>;
export const gardenPackPurchaseReceiptSchema = z.strictObject({
    purchaseId: z.string().uuid(),
    productId,
    productVersionId: productId,
    chargedSunflowers: z.number().int().min(1).max(2_147_483_647),
    currency: z.literal('sunflower'),
    purchasedAt: z.iso.datetime(),
    totalQuantity: z.number().int().min(1).max(1000),
});
export type GardenPackPurchaseReceipt = z.infer<
    typeof gardenPackPurchaseReceiptSchema
>;
