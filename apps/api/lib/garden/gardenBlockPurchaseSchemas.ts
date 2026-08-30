import { z } from 'zod';

const postgresInt32Maximum = 2_147_483_647;
const postgresInt32Minimum = -2_147_483_648;

export const gardenBlockPurchaseParamSchema = z
    .object({
        gardenId: z
            .string()
            .min(1)
            .max(10)
            .regex(/^[1-9]\d*$/)
            .transform(Number)
            .pipe(z.number().int().positive().max(postgresInt32Maximum)),
    })
    .strict();

const boundedIdentifierSchema = z
    .string()
    .min(1)
    .max(128)
    .refine((value) => value.trim() === value, {
        message: 'Identifiers must not have leading or trailing whitespace.',
    });

export const gardenBlockPurchaseBodySchema = z
    .object({
        operationId: z
            .string()
            .min(1)
            .max(96)
            .refine((value) => value.trim() === value, {
                message:
                    'Operation ID must not have leading or trailing whitespace.',
            })
            .optional(),
        blockName: boundedIdentifierSchema,
        expectedExistingBlocks: z
            .array(boundedIdentifierSchema)
            .max(128)
            .optional(),
        variant: z
            .number()
            .int()
            .nonnegative()
            .max(postgresInt32Maximum)
            .optional(),
        position: z
            .object({
                x: z
                    .number()
                    .int()
                    .min(postgresInt32Minimum)
                    .max(postgresInt32Maximum),
                y: z
                    .number()
                    .int()
                    .min(postgresInt32Minimum)
                    .max(postgresInt32Maximum),
            })
            .strict()
            .optional(),
    })
    .strict();
