import {
    getPurchasedGardenPack,
    isGardenPackPlacementStorageReady,
} from '@gredice/storage';
import {
    gardenPackGroupPlacementBodySchema,
    gardenPackGroupPlacementIdentitySchema,
} from '@gredice/storage/gardenPackGroupPlacementContract';
import { Hono } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { getBlockData } from '../../../lib/blocks/blockDataService';
import { authSecurity } from '../../../lib/docs/security';
import { settleGardenEconomicMutationDependency } from '../../../lib/garden/gardenEconomicMutationDependency';
import {
    assertGardenPackLayoutDirectory,
    placeGardenPackGroupForAccount,
} from '../../../lib/garden/gardenPackGroupPlacementService';
import { getOwnedGardenPackLayouts } from '../../../lib/garden/gardenPackLayouts';
import {
    getGardenPackStorageReadiness,
    isGardenPackStorageEnabled,
} from '../../../lib/garden/gardenPackRollout';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';

const defaults = {
    authValidator,
    isStorageEnabled: isGardenPackStorageEnabled,
    isStorageReady: async () =>
        (await getGardenPackStorageReadiness()) &&
        (await isGardenPackPlacementStorageReady()),
    getPack: getPurchasedGardenPack,
    getBlocks: getBlockData,
    place: placeGardenPackGroupForAccount,
};
export function createGardenPackGroupPlacementRoutes(
    dependencies: typeof defaults = defaults,
) {
    return new Hono<{ Variables: AuthVariables }>()
        .get(
            '/:purchaseId/layouts',
            describeRoute({
                description:
                    'Get reviewed optional layouts for an owned pack. Exact paid contents only; no scenery or purchase. Unsupported current catalogue identities omit layouts. Disabled storage returns an empty disabled result.',
                security: authSecurity,
                tags: ['Garden packs'],
                responses: {
                    200: {
                        description: 'Owned layouts or empty disabled result.',
                    },
                    400: { description: 'Invalid purchase identifier.' },
                    401: { description: 'Authentication required.' },
                    404: { description: 'Owned purchase not found.' },
                },
            }),
            dependencies.authValidator(['user', 'admin']),
            zValidator(
                'param',
                gardenPackGroupPlacementIdentitySchema.pick({
                    purchaseId: true,
                }),
            ),
            async (context) => {
                context.header('Cache-Control', 'private, no-store');
                const purchaseId = context.req.valid('param').purchaseId;
                if (
                    !dependencies.isStorageEnabled() ||
                    !(await dependencies.isStorageReady())
                )
                    return context.json({
                        enabled: false,
                        accountId: null,
                        purchaseId,
                        layouts: [],
                    });
                const accountId = context.get('authContext').accountId;
                const pack = await dependencies.getPack(accountId, purchaseId);
                if (!pack)
                    return context.json(
                        {
                            code: 'PACK_NOT_FOUND',
                            error: 'Kupljeni paket nije pronađen.',
                        },
                        404,
                    );
                const directory = await settleGardenEconomicMutationDependency(
                    dependencies.getBlocks,
                );
                const layouts =
                    directory.status === 'fulfilled'
                        ? getOwnedGardenPackLayouts(pack).filter((layout) => {
                              try {
                                  assertGardenPackLayoutDirectory(
                                      layout,
                                      directory.value,
                                  );
                                  return true;
                              } catch {
                                  return false;
                              }
                          })
                        : [];
                return context.json({
                    enabled: true,
                    accountId,
                    purchaseId,
                    layouts,
                });
            },
        )
        .post(
            '/:purchaseId/layouts/:layoutId/place',
            describeRoute({
                description:
                    'Atomically place every selected owned prepaid unit using a versioned server layout. No wallet debit or implicit purchase. Exact account-scoped UUID receipt replays after catalogue withdrawal; different command conflicts. All cells and quantities validate before any placement.',
                security: authSecurity,
                tags: ['Garden packs'],
                responses: {
                    200: {
                        description:
                            'Complete group placement or exact durable replay; zero sunflowers charged.',
                    },
                    400: {
                        description:
                            'Invalid command or missing footprint-cell assertions.',
                    },
                    401: { description: 'Authentication required.' },
                    404: {
                        description:
                            'Storage disabled, owned pack/unit/garden not found.',
                    },
                    409: {
                        description:
                            'Account, operation, layout, quantity, occupancy or deletion conflict.',
                    },
                    503: {
                        description:
                            'Incomplete storage readiness or unavailable directory.',
                    },
                    500: {
                        description:
                            'Unexpected failure; retry the exact command.',
                    },
                },
            }),
            dependencies.authValidator(['user', 'admin']),
            zValidator('param', gardenPackGroupPlacementIdentitySchema),
            zValidator('json', gardenPackGroupPlacementBodySchema),
            async (context) => {
                context.header('Cache-Control', 'private, no-store');
                const accountId = context.get('authContext').accountId;
                const body = context.req.valid('json');
                if (body.expectedAccountId !== accountId)
                    return context.json(
                        {
                            code: 'EXPECTED_ACCOUNT_MISMATCH',
                            error: 'Račun se promijenio. Vrati se na račun za ovaj raspored.',
                        },
                        409,
                    );
                if (!dependencies.isStorageEnabled())
                    return context.json(
                        {
                            code: 'PACKS_DISABLED',
                            error: 'Paketi trenutačno nisu dostupni.',
                        },
                        404,
                    );
                if (!(await dependencies.isStorageReady()))
                    return context.json(
                        {
                            code: 'PACK_STORAGE_UNAVAILABLE',
                            error: 'Paketi trenutačno nisu dostupni.',
                        },
                        503,
                    );
                try {
                    const result = await dependencies.place({
                        ...body,
                        ...context.req.valid('param'),
                        accountId,
                    });
                    if (!result.ok)
                        return context.json(
                            { code: result.code, error: result.error },
                            result.status,
                        );
                    const { ok: _ok, ...response } = result;
                    return context.json(response);
                } catch (error) {
                    console.error('Garden pack group placement failed', error);
                    return context.json(
                        {
                            code: 'GROUP_PLACEMENT_FAILED',
                            error: 'Postavljanje rasporeda nije uspjelo. Pokušaj ponovno istim zahtjevom.',
                        },
                        500,
                    );
                }
            },
        );
}
export const gardenPackGroupPlacementRoutes =
    createGardenPackGroupPlacementRoutes();
