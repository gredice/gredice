import {
    GardenBoxInventoryLimitError,
    GardenPackConflictError,
    GardenPackNotFoundError,
    isGardenPackLifecycleStorageReady,
    refundGardenPackUnits,
} from '@gredice/storage';
import { gardenPackPlacementIdentitySchema } from '@gredice/storage/gardenPackPlacementContract';
import { Hono } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import { authSecurity } from '../../../lib/docs/security';
import { retrieveStoredGardenPackUnit } from '../../../lib/garden/gardenPackLifecycleService';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';

const operationId = z
    .string()
    .min(1)
    .max(96)
    .refine((value) => value.trim() === value);
function failure(error: unknown): {
    body: { error: string; code: string };
    status: 400 | 404 | 409 | 503;
} {
    if (error instanceof GardenPackNotFoundError)
        return {
            body: { error: error.message, code: 'PACK_NOT_FOUND' },
            status: 404,
        };
    if (error instanceof GardenPackConflictError)
        return {
            body: { error: error.message, code: 'OPERATION_CONFLICT' },
            status: 409,
        };
    if (error instanceof GardenBoxInventoryLimitError)
        return {
            body: { error: error.message, code: 'GARDEN_BOX_INVENTORY_LIMIT' },
            status: 400,
        };
    console.error('Failed to mutate prepaid garden pack lifecycle', { error });
    return {
        body: {
            error: 'Promjena nije uspjela. Pokušaj ponovno s istim zahtjevom.',
            code: 'PACK_LIFECYCLE_UNAVAILABLE',
        },
        status: 503,
    };
}
export const gardenPackLifecycleRoutes = new Hono<{
    Variables: AuthVariables;
}>()
    .post(
        '/:purchaseId/refund',
        describeRoute({
            description:
                'Refund an exact list of unused units owned by the current account at their original paid allocation. Partially used packs are supported. A durable account-scoped operation receipt prevents repeated credits; no current catalogue or sale availability is required.',
            security: authSecurity,
            tags: ['Garden packs'],
        }),
        authValidator(['user', 'admin']),
        zValidator('param', z.strictObject({ purchaseId: z.string().uuid() })),
        zValidator(
            'json',
            z.strictObject({
                operationId,
                units: z
                    .array(
                        gardenPackPlacementIdentitySchema.omit({
                            purchaseId: true,
                        }),
                    )
                    .min(1)
                    .max(1000),
            }),
        ),
        async (context) => {
            context.header('Cache-Control', 'private, no-store');
            if (!(await isGardenPackLifecycleStorageReady()))
                return context.json(
                    {
                        error: 'Garden pack lifecycle storage is not ready',
                        code: 'PACK_STORAGE_NOT_READY',
                    },
                    503,
                );
            try {
                return context.json(
                    await refundGardenPackUnits(
                        context.get('authContext').accountId,
                        {
                            ...context.req.valid('param'),
                            ...context.req.valid('json'),
                        },
                    ),
                );
            } catch (error) {
                const response = failure(error);
                return context.json(response.body, response.status);
            }
        },
    )
    .post(
        '/:purchaseId/units/:lineId/:unitOrdinal/retrieve',
        describeRoute({
            description:
                'Retrieve exactly one owned stored pack unit into the same active garden as its physical box, preserving its original block identity and fixed appearance. Restores rotation to the default before validated placement. No sunflower debit and no restoration of pack quantity. Retry the identical operation ID to read its durable receipt.',
            security: authSecurity,
            tags: ['Garden packs'],
        }),
        authValidator(['user', 'admin']),
        zValidator('param', gardenPackPlacementIdentitySchema),
        zValidator(
            'json',
            z.strictObject({
                operationId,
                gardenId: z.number().int().positive(),
                gardenBoxBlockId: z.string().min(1).max(128),
            }),
        ),
        async (context) => {
            context.header('Cache-Control', 'private, no-store');
            if (!(await isGardenPackLifecycleStorageReady()))
                return context.json(
                    {
                        error: 'Garden pack lifecycle storage is not ready',
                        code: 'PACK_STORAGE_NOT_READY',
                    },
                    503,
                );
            try {
                return context.json(
                    await retrieveStoredGardenPackUnit(
                        context.get('authContext').accountId,
                        {
                            ...context.req.valid('param'),
                            ...context.req.valid('json'),
                        },
                    ),
                );
            } catch (error) {
                const response = failure(error);
                return context.json(response.body, response.status);
            }
        },
    );
