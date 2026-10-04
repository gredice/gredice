import type { GardenPackCatalogueOffer } from '@gredice/client';
import {
    autumnArrangements,
    getAutumnArrangementItems,
} from '../src/arrangements/autumnArrangements';

/** Test-only quotes; never imported by runtime catalogue configuration. */
export function createGardenPackOfferFixture(): GardenPackCatalogueOffer {
    const arrangement = autumnArrangements[0];
    if (!arrangement) throw new Error('Arrangement fixture missing');
    return {
        productId: 'storefront-fixture',
        productVersionId: 'fixture:v1',
        name: { hr: 'Jesenska berba' },
        description: { hr: 'Točan sadržaj probnog paketa.' },
        previews: [
            'https://vrt.gredice.com/assets/arrangements/harvest-corner.png',
        ],
        quote: {
            productVersionId: 'fixture:v1',
            chargedSunflowers: 11,
            currency: 'sunflower',
        },
        lines: getAutumnArrangementItems(arrangement, 'included').map(
            (item, index) => ({
                lineId: `line-${index}`,
                entityId: String(801 + index),
                modelName: item.entityName,
                variant: null,
                quantity: item.quantity,
                label:
                    [
                        'Skupina bundeva',
                        'Krem bundeva',
                        'Sanduk voća',
                        'Strašilo',
                    ][index] ?? item.entityName,
            }),
        ),
        available: true,
        unavailableReason: null,
        individualTotalSunflowers: 20,
    };
}
