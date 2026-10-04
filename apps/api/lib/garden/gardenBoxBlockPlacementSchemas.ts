import { z } from 'zod';

export const gardenBoxBlockPlacementBodySchema = z
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
    })
    .strict()
    .default({});

export function resolveGardenBoxBlockPlacementOperationId(
    operationId: string | undefined,
    createId: () => string = () => globalThis.crypto.randomUUID(),
) {
    return operationId ?? `legacy-garden-box-place-${createId()}`;
}
