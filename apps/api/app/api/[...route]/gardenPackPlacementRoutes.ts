import { isGardenPackPlacementStorageReady } from '@gredice/storage';
import {
    gardenPackPlacementBodySchema,
    gardenPackPlacementIdentitySchema,
} from '@gredice/storage/gardenPackPlacementContract';
import { Hono } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { authSecurity } from '../../../lib/docs/security';
import { placeGardenPackUnitForAccount } from '../../../lib/garden/gardenPackPlacementService';
import {
    getGardenPackStorageReadiness,
    isGardenPackStorageEnabled,
} from '../../../lib/garden/gardenPackRollout';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';

export const gardenPackPlacementRoutes = new Hono<{
    Variables: AuthVariables;
}>().post(
    '/:purchaseId/units/:lineId/:unitOrdinal/place',
    describeRoute({
        description:
            'Place exactly one owned prepaid pack unit, preserving its fixed appearance and an account-scoped exact replay receipt. No sunflower debit.',
        security: authSecurity,
        tags: ['Garden packs'],
    }),
    authValidator(['user', 'admin']),
    zValidator('param', gardenPackPlacementIdentitySchema),
    zValidator('json', gardenPackPlacementBodySchema),
    async (context) => {
        if (!isGardenPackStorageEnabled())
            return context.json(
                {
                    error: 'Garden packs are not enabled',
                    code: 'PACKS_DISABLED',
                },
                404,
            );
        if ((!(await getGardenPackStorageReadiness()) || !(await isGardenPackPlacementStorageReady())))
            return context.json(
                {
                    error: 'Garden pack storage is not ready',
                    code: 'PACK_STORAGE_NOT_READY',
                },
                503,
            );
        const { accountId } = context.get('authContext');
        try {
            const result = await placeGardenPackUnitForAccount({
                ...context.req.valid('param'),
                ...context.req.valid('json'),
                accountId,
            });
            if (!result.ok)
                return context.json(
                    { error: result.error, code: result.code },
                    result.status,
                );
            return context.json(result);
        } catch (error) {
            console.error('Failed to place prepaid garden pack unit', {
                accountId,
                gardenId: context.req.valid('json').gardenId,
                error,
            });
            return context.json(
                {
                    error: 'Prepaid placement failed; retry the same request',
                    code: 'PLACEMENT_FAILED',
                },
                500,
            );
        }
    },
);
