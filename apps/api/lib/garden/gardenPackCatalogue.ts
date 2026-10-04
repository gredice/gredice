import 'server-only';
import { gardenPackProductSnapshotSchema } from '@gredice/storage/gardenPackContract';
import { z } from 'zod';

export const gardenPackOfferSchema = z.strictObject({
    snapshot: gardenPackProductSnapshotSchema,
    sale: z
        .strictObject({
            enabled: z.boolean(),
            availableFrom: z.iso.datetime().nullable(),
            availableUntil: z.iso.datetime().nullable(),
        })
        .refine(
            (sale) =>
                sale.availableFrom === null ||
                sale.availableUntil === null ||
                Date.parse(sale.availableFrom) <
                    Date.parse(sale.availableUntil),
            'Sale must end after it starts',
        ),
});
const catalogueSchema = z
    .array(gardenPackOfferSchema)
    .max(100)
    .refine(
        (offers) =>
            new Set(offers.map((offer) => offer.snapshot.productId)).size ===
            offers.length,
        'A product requires one current offer',
    );
export type GardenPackOffer = z.infer<typeof gardenPackOfferSchema>;

/** Trusted server deployment config, empty by default; contains no pilot prices. */
export async function getGardenPackCatalogue(): Promise<GardenPackOffer[]> {
    const configuration = process.env.GREDICE_GARDEN_PACK_CATALOGUE_JSON;
    if (!configuration) return [];
    if (Buffer.byteLength(configuration) > 1_000_000)
        throw new Error('Garden pack catalogue exceeds its size limit');
    return catalogueSchema.parse(JSON.parse(configuration));
}
