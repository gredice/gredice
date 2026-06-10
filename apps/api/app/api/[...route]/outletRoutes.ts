import {
    type EntityStandardized,
    getEntitiesFormatted,
    getOutletOffer,
    getOutletOffers,
    type OutletOfferWithAvailability,
} from '@gredice/storage';
import { Hono } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import { publicSecurity } from '../../../lib/docs/security';
import { setCacheControl } from '../../../lib/http/cacheControl';

const outletCacheControl = {
    visibility: 'public',
    maxAgeSeconds: 0,
    sharedMaxAgeSeconds: 0,
    mustRevalidate: true,
} as const;

function wwwOrigin() {
    return (
        process.env.NEXT_PUBLIC_GREDICE_WWW_ORIGIN?.replace(/\/+$/u, '') ??
        'https://www.gredice.com'
    );
}

function plantSortImageUrl(plantSort: EntityStandardized) {
    return (
        plantSort.image?.cover?.url ??
        plantSort.images?.cover?.url ??
        plantSort.information?.plant?.image?.cover?.url ??
        plantSort.information?.plant?.images?.cover?.url ??
        null
    );
}

function outletOfferResponse(
    offer: OutletOfferWithAvailability,
    plantSort: EntityStandardized,
) {
    const imageUrls =
        offer.imageUrls.length > 0
            ? offer.imageUrls
            : plantSortImageUrl(plantSort)
              ? [plantSortImageUrl(plantSort) ?? '']
              : [];

    return {
        id: offer.id,
        plantSort: {
            id: plantSort.id,
            name:
                plantSort.information?.label ??
                plantSort.information?.name ??
                'Sadnica',
            description:
                plantSort.information?.shortDescription ??
                plantSort.information?.description ??
                null,
            imageUrl: plantSortImageUrl(plantSort),
            plant: plantSort.information?.plant
                ? {
                      id: plantSort.information.plant.id,
                      name:
                          plantSort.information.plant.information?.label ??
                          plantSort.information.plant.information?.name ??
                          null,
                  }
                : null,
        },
        sowingDate: offer.sowingDate,
        initialPlantStatus: offer.initialPlantStatus,
        imageUrls,
        outletPrice: offer.outletPriceCents / 100,
        comparePrice:
            typeof offer.comparePriceCents === 'number'
                ? offer.comparePriceCents / 100
                : null,
        quantity: offer.quantity,
        remainingQuantity: offer.remainingQuantity,
        reservedQuantity: offer.reservedQuantity,
        soldQuantity: offer.soldQuantity,
        startAt: offer.startAt,
        endAt: offer.endAt,
        url: `${wwwOrigin()}/outlet?offer=${offer.id}`,
    };
}

async function getPlantSortsById() {
    const plantSorts =
        await getEntitiesFormatted<EntityStandardized>('plantSort');
    return new Map(plantSorts.map((plantSort) => [plantSort.id, plantSort]));
}

const app = new Hono()
    .get(
        '/offers',
        describeRoute({
            description: 'List active discounted Outlet seedling offers.',
            security: publicSecurity,
            tags: ['Outlet'],
        }),
        async (context) => {
            const [offers, plantSortsById] = await Promise.all([
                getOutletOffers(),
                getPlantSortsById(),
            ]);

            setCacheControl(context, outletCacheControl);
            return context.json({
                items: offers.flatMap((offer) => {
                    const plantSort = plantSortsById.get(offer.plantSortId);
                    if (!plantSort) {
                        return [];
                    }

                    return [outletOfferResponse(offer, plantSort)];
                }),
            });
        },
    )
    .get(
        '/offers/:offerId',
        describeRoute({
            description: 'Get one active discounted Outlet seedling offer.',
            security: publicSecurity,
            tags: ['Outlet'],
        }),
        zValidator(
            'param',
            z.object({
                offerId: z.coerce.number().int().positive(),
            }),
        ),
        async (context) => {
            const { offerId } = context.req.valid('param');
            const [offer, plantSortsById] = await Promise.all([
                getOutletOffer(offerId),
                getPlantSortsById(),
            ]);
            if (!offer) {
                return context.json(
                    { error: 'Outlet offer not found' },
                    { status: 404 },
                );
            }

            const now = Date.now();
            if (
                offer.status !== 'published' ||
                offer.startAt.getTime() > now ||
                offer.endAt.getTime() <= now ||
                offer.remainingQuantity <= 0
            ) {
                return context.json(
                    { error: 'Outlet offer not found' },
                    { status: 404 },
                );
            }

            const plantSort = plantSortsById.get(offer.plantSortId);
            if (!plantSort) {
                return context.json(
                    { error: 'Outlet offer not found' },
                    { status: 404 },
                );
            }

            setCacheControl(context, outletCacheControl);
            return context.json(outletOfferResponse(offer, plantSort));
        },
    );

export default app;
