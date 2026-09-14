import { getPublicPriceCatalog } from '@gredice/storage';
import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { z } from 'zod';
import { publicSecurity } from '../../../lib/docs/security';

const priceSchema = z.object({
    key: z.string(),
    entityId: z.number(),
    entityTypeName: z.string(),
    name: z.string(),
    price: z.number().nonnegative(),
    currency: z.string(),
    unit: z.string(),
    available: z.boolean(),
    specialSale: z.string(),
    anchorPrice: z
        .object({ price: z.number().nonnegative(), date: z.string() })
        .nullable(),
});

export function createPricingRoutes(loadCatalog = getPublicPriceCatalog) {
    return new Hono().get(
        '/',
        describeRoute({
            description:
                'Published service prices and recorded reference prices. Missing historical evidence is returned as null.',
            security: publicSecurity,
            responses: {
                200: {
                    description: 'Public price catalog',
                    content: {
                        'application/json': {
                            schema: resolver(z.array(priceSchema)),
                        },
                    },
                },
            },
        }),
        async (context) => context.json(await loadCatalog()),
    );
}

export default createPricingRoutes();
