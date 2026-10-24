import { Hono, type MiddlewareHandler } from 'hono';
import { describeRoute } from 'hono-openapi';
import { authSecurity } from '../../../lib/docs/security';
import {
    type GardenPackCatalogueOffer,
    readGardenPackOffers,
} from '../../../lib/garden/gardenPackCatalogueRead';
import {
    getGardenPackStorageReadiness,
    isGardenPackSalesEnabled,
    isGardenPackStorageEnabled,
} from '../../../lib/garden/gardenPackRollout';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';

export function createGardenPackCatalogueRoutes(
    dependencies: {
        auth: (
            roles: string[],
        ) => MiddlewareHandler<{ Variables: AuthVariables }>;
        storageEnabled: () => boolean;
        salesEnabled: () => boolean;
        ready: () => Promise<boolean>;
        offers: () => Promise<GardenPackCatalogueOffer[]>;
    } = {
        auth: authValidator,
        storageEnabled: isGardenPackStorageEnabled,
        salesEnabled: isGardenPackSalesEnabled,
        ready: getGardenPackStorageReadiness,
        offers: readGardenPackOffers,
    },
) {
    return new Hono<{ Variables: AuthVariables }>().get(
        '/',
        describeRoute({
            description:
                'Get trusted garden-pack offers for the current authenticated account. Exact fixed contents and quotes are resolved on the server. Disabled storage/sales or incomplete guards return an empty disabled catalogue; owned inventory remains separate. Individual-price comparison is omitted when invalid.',
            security: authSecurity,
            tags: ['Garden packs'],
            responses: {
                200: {
                    description: 'Trusted offers or empty disabled catalogue.',
                },
                401: { description: 'Authentication required.' },
                503: { description: 'Catalogue temporarily unavailable.' },
            },
        }),
        dependencies.auth(['user', 'admin']),
        async (context) => {
            context.header('Cache-Control', 'private, no-store');
            const offers: GardenPackCatalogueOffer[] = [];
            try {
                if (
                    !dependencies.storageEnabled() ||
                    !dependencies.salesEnabled() ||
                    !(await dependencies.ready())
                )
                    return context.json({
                        enabled: false,
                        accountId: null,
                        offers,
                    });
                return context.json({
                    enabled: true,
                    accountId: context.get('authContext').accountId,
                    offers: await dependencies.offers(),
                });
            } catch {
                return context.json(
                    { error: 'Ponudu paketa trenutačno nije moguće učitati.' },
                    503,
                );
            }
        },
    );
}
export default createGardenPackCatalogueRoutes();
