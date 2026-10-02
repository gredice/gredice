import type {
    GardenPackCatalogueOffer,
    GardenPackPurchaseInput,
} from '@gredice/client';
import {
    autumnArrangements,
    getAutumnArrangementItems,
} from '../arrangements/autumnArrangements';

export function getReviewedGardenPackPreview(offer: GardenPackCatalogueOffer) {
    if (offer.lines.some((line) => line.variant !== null)) return undefined;
    const quantities = new Map<string, number>();
    for (const line of offer.lines)
        quantities.set(
            line.modelName,
            (quantities.get(line.modelName) ?? 0) + line.quantity,
        );
    return autumnArrangements.flatMap((arrangement) => {
        const included = getAutumnArrangementItems(arrangement, 'included');
        if (
            included.length !== quantities.size ||
            included.some(
                (item) => quantities.get(item.entityName) !== item.quantity,
            )
        )
            return [];
        const url = offer.previews.find((preview) => {
            try {
                const configured = new URL(preview);
                return (
                    configured.protocol === 'https:' &&
                    configured.hostname === 'vrt.gredice.com' &&
                    configured.pathname === arrangement.preview &&
                    !configured.search &&
                    !configured.hash
                );
            } catch {
                return false;
            }
        });
        return url
            ? [
                  {
                      arrangement,
                      url: arrangement.preview,
                      scenery: getAutumnArrangementItems(
                          arrangement,
                          'scenery',
                      ),
                  },
              ]
            : [];
    })[0];
}

export function getGardenPackComparison(offer: GardenPackCatalogueOffer) {
    const total = offer.individualTotalSunflowers;
    if (total === null || !Number.isSafeInteger(total) || total <= 0)
        return null;
    return { total, saving: total - offer.quote.chargedSunflowers };
}

/** Browser recovery is untrusted input and never supplies server authority. */
export function readStoredGardenPackCommand(
    value: unknown,
): GardenPackPurchaseInput | null {
    if (
        !value ||
        typeof value !== 'object' ||
        !('expectedAccountId' in value) ||
        typeof value.expectedAccountId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(
            value.expectedAccountId,
        ) ||
        !('operationId' in value) ||
        typeof value.operationId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(
            value.operationId,
        ) ||
        !('productId' in value) ||
        typeof value.productId !== 'string' ||
        !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/u.test(value.productId) ||
        !('quote' in value) ||
        !value.quote ||
        typeof value.quote !== 'object'
    )
        return null;
    const quote = value.quote;
    if (
        !('currency' in quote) ||
        quote.currency !== 'sunflower' ||
        !('productVersionId' in quote) ||
        typeof quote.productVersionId !== 'string' ||
        !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/u.test(quote.productVersionId) ||
        !('chargedSunflowers' in quote) ||
        typeof quote.chargedSunflowers !== 'number' ||
        !Number.isSafeInteger(quote.chargedSunflowers) ||
        quote.chargedSunflowers < 1 ||
        quote.chargedSunflowers > 2_147_483_647
    )
        return null;
    return {
        operationId: value.operationId,
        expectedAccountId: value.expectedAccountId,
        productId: value.productId,
        quote: {
            productVersionId: quote.productVersionId,
            chargedSunflowers: quote.chargedSunflowers,
            currency: quote.currency,
        },
    };
}
