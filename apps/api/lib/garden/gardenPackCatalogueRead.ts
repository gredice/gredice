import type { BlockData } from '@gredice/directory-types';
import { isGardenPackAvailableForPurchase } from '@gredice/storage/gardenPackContract';
import { getBlockData } from '../blocks/blockDataService';
import { settleGardenEconomicMutationDependency } from './gardenEconomicMutationDependency';
import {
    type GardenPackOffer,
    getGardenPackCatalogue,
} from './gardenPackCatalogue';
import { assertGardenPackPurchaseContents } from './gardenPackEligibility';

export function getGardenPackIndividualTotal(
    offer: GardenPackOffer,
    blocks: readonly BlockData[],
) {
    let total = 0;
    for (const line of offer.snapshot.lines) {
        const matches = blocks.filter(
            (block) =>
                block.id.toString() === line.entityId &&
                block.information.name === line.modelName,
        );
        const block = matches[0];
        const price = block?.prices.sunflowers;
        if (
            matches.length !== 1 ||
            !Number.isSafeInteger(price) ||
            (price ?? 0) <= 0
        )
            return null;
        total += (price ?? 0) * line.quantity;
        if (!Number.isSafeInteger(total) || total > 2_147_483_647) return null;
    }
    return total;
}

export function projectGardenPackOffer(
    offer: GardenPackOffer,
    blocks: readonly BlockData[],
    now: Date,
) {
    const { snapshot, sale } = offer;
    let contentsAvailable = snapshot.chargedSunflowers > 0;
    try {
        assertGardenPackPurchaseContents(snapshot, blocks, now);
    } catch {
        contentsAvailable = false;
    }
    const time = now.getTime();
    const expired =
        (snapshot.availableUntil !== null &&
            time >= Date.parse(snapshot.availableUntil)) ||
        (sale.availableUntil !== null &&
            time >= Date.parse(sale.availableUntil));
    const scheduled =
        (snapshot.availableFrom !== null &&
            time < Date.parse(snapshot.availableFrom)) ||
        (sale.availableFrom !== null && time < Date.parse(sale.availableFrom));
    const available =
        sale.enabled &&
        isGardenPackAvailableForPurchase(snapshot, now) &&
        !expired &&
        !scheduled &&
        contentsAvailable;
    const unavailableReason:
        | 'expired'
        | 'scheduled'
        | 'disabled'
        | 'contents'
        | null = available
        ? null
        : expired
          ? 'expired'
          : scheduled
            ? 'scheduled'
            : !sale.enabled
              ? 'disabled'
              : 'contents';
    return {
        productId: snapshot.productId,
        productVersionId: snapshot.productVersionId,
        name: snapshot.name,
        description: snapshot.description,
        previews: snapshot.previews,
        quote: {
            productVersionId: snapshot.productVersionId,
            chargedSunflowers: snapshot.chargedSunflowers,
            currency: snapshot.currency,
        },
        lines: snapshot.lines.map((line) => ({
            lineId: line.lineId,
            entityId: line.entityId,
            modelName: line.modelName,
            variant: line.variant,
            quantity: line.quantity,
            label:
                blocks.find(
                    (block) =>
                        block.id.toString() === line.entityId &&
                        block.information.name === line.modelName,
                )?.information.label ?? line.modelName,
        })),
        available,
        unavailableReason,
        individualTotalSunflowers: contentsAvailable
            ? getGardenPackIndividualTotal(offer, blocks)
            : null,
    };
}
export type GardenPackCatalogueOffer = ReturnType<
    typeof projectGardenPackOffer
>;

export async function readGardenPackOffers() {
    const prepared = await settleGardenEconomicMutationDependency(async () => {
        const [offers, blocks] = await Promise.all([
            getGardenPackCatalogue(),
            getBlockData(),
        ]);
        return { offers, blocks };
    });
    if (prepared.status === 'rejected')
        throw new Error('Catalogue unavailable');
    const now = new Date();
    return prepared.value.offers
        .filter((offer) => offer.snapshot.publication === 'published')
        .map((offer) =>
            projectGardenPackOffer(offer, prepared.value.blocks, now),
        );
}
