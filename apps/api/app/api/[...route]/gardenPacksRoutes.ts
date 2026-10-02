import {
    type GardenPackInventoryPurchase,
    gardenPackInventoryQuerySchema,
    getGardenPackInventoryPage,
    getGardenPackInventoryPurchase,
} from '@gredice/storage';
import { Hono, type MiddlewareHandler } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import { authSecurity } from '../../../lib/docs/security';
import { gardenPackPurchaseBodySchema } from '../../../lib/garden/gardenPackPurchaseSchemas';
import { purchaseGardenPackForAccount } from '../../../lib/garden/gardenPackPurchaseService';
import {
    getGardenPackStorageReadiness,
    isGardenPackStorageEnabled,
} from '../../../lib/garden/gardenPackRollout';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';
import { gardenPackLifecycleRoutes } from './gardenPackLifecycleRoutes';
import { gardenPackPlacementRoutes } from './gardenPackPlacementRoutes';

export type GardenPacksRouteDependencies = {
    authValidator: (
        roles: string[],
    ) => MiddlewareHandler<{ Variables: AuthVariables }>;
    isStorageEnabled: typeof isGardenPackStorageEnabled;
    isStorageReady: typeof getGardenPackStorageReadiness;
    getPage: typeof getGardenPackInventoryPage;
    getPurchase: typeof getGardenPackInventoryPurchase;
    purchase: typeof purchaseGardenPackForAccount;
};
const defaultDependencies: GardenPacksRouteDependencies = {
    authValidator,
    isStorageEnabled: isGardenPackStorageEnabled,
    isStorageReady: getGardenPackStorageReadiness,
    getPage: getGardenPackInventoryPage,
    getPurchase: getGardenPackInventoryPurchase,
    purchase: purchaseGardenPackForAccount,
};

export function createGardenPacksRoutes(
    dependencies: GardenPacksRouteDependencies = defaultDependencies,
) {
    return new Hono<{ Variables: AuthVariables }>()
        .get(
            '/',
            describeRoute({
                description:
                    'Get purchased packs for the authenticated current account. Sales withdrawal and season expiry do not hide owned items. Storage rollout disabled returns an empty disabled result.',
                security: authSecurity,
                tags: ['Garden packs'],
                responses: {
                    200: {
                        description:
                            'Owned pack data or storage-disabled result.',
                    },
                    400: { description: 'Invalid request or cursor.' },
                    401: { description: 'Authentication required.' },
                },
            }),
            dependencies.authValidator(['user', 'admin']),
            zValidator('query', gardenPackInventoryQuerySchema),
            async (context) => {
                context.header('Cache-Control', 'private, no-store');
                const accountId = context.get('authContext').accountId;
                const purchases: GardenPackInventoryPurchase[] = [];
                if (
                    !dependencies.isStorageEnabled() ||
                    !(await dependencies.isStorageReady())
                )
                    return context.json({
                        enabled: false,
                        accountId: null,
                        purchases,
                        hasMore: false,
                        nextCursor: null,
                    });
                try {
                    const page = await dependencies.getPage(
                        accountId,
                        context.req.valid('query'),
                    );
                    return context.json({ enabled: true, accountId, ...page });
                } catch (error) {
                    if (
                        error instanceof z.ZodError ||
                        error instanceof SyntaxError
                    )
                        return context.json(
                            {
                                error: 'Neispravan pokazivač stranice.',
                                code: 'INVALID_CURSOR',
                            },
                            400,
                        );
                    throw error;
                }
            },
        )
        .get(
            '/:purchaseId',
            describeRoute({
                description:
                    'Get one purchased pack owned by the authenticated current account. Unknown and foreign purchases return 404; disabled storage returns a disabled result.',
                security: authSecurity,
                tags: ['Garden packs'],
                responses: {
                    200: {
                        description:
                            'Owned pack data or storage-disabled result.',
                    },
                    400: { description: 'Invalid purchase identifier.' },
                    401: { description: 'Authentication required.' },
                    404: { description: 'Owned pack or product not found.' },
                },
            }),
            dependencies.authValidator(['user', 'admin']),
            zValidator('param', z.object({ purchaseId: z.string().uuid() })),
            async (context) => {
                context.header('Cache-Control', 'private, no-store');
                if (
                    !dependencies.isStorageEnabled() ||
                    !(await dependencies.isStorageReady())
                )
                    return context.json({ enabled: false, purchase: null });
                const purchase = await dependencies.getPurchase(
                    context.get('authContext').accountId,
                    context.req.valid('param').purchaseId,
                );
                if (!purchase)
                    return context.json(
                        {
                            error: 'Paket nije pronađen.',
                            code: 'PACK_NOT_FOUND',
                        },
                        404,
                    );
                return context.json({ enabled: true, purchase });
            },
        )
        .post(
            '/purchase',
            describeRoute({
                description:
                    'Buy an exact server-owned published pack quote using sunflowers. Wallet debit and finite quantities commit atomically without requiring a garden or box. The UUID request ID replays the immutable receipt; changed input/quote returns 409. Insufficient balance or invalid request returns 400; missing product/account returns 404; unavailable rollout/catalogue returns 503.',
                security: authSecurity,
                tags: ['Garden packs'],
                responses: {
                    200: {
                        description:
                            'Immutable purchase receipt or exact completed replay.',
                    },
                    400: {
                        description:
                            'Invalid request or insufficient sunflowers.',
                    },
                    401: { description: 'Authentication required.' },
                    404: { description: 'Product or account not found.' },
                    409: {
                        description:
                            'Operation, quote, availability or account deletion conflict.',
                    },
                    503: {
                        description:
                            'Storage or sales disabled, storage not ready, or dependency unavailable.',
                    },
                },
            }),
            dependencies.authValidator(['user', 'admin']),
            zValidator('json', gardenPackPurchaseBodySchema),
            async (context) => {
                context.header('Cache-Control', 'private, no-store');
                const result = await dependencies.purchase(
                    context.get('authContext').accountId,
                    context.req.valid('json'),
                );
                if (!result.ok)
                    return context.json(
                        { error: result.error, code: result.code },
                        result.status,
                    );
                return context.json({
                    ...result.receipt,
                    replayed: result.replayed,
                });
            },
        );
}
export default createGardenPacksRoutes()
    .route('/', gardenPackPlacementRoutes)
    .route('/', gardenPackLifecycleRoutes);
