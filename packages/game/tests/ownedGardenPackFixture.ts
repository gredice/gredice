import type { OwnedGardenPack } from '../src/hud/ownedGardenPackInventory';

export function createOwnedGardenPackFixture(
    purchaseId = 'purchase-one',
): OwnedGardenPack {
    return {
        purchaseId,
        productId: 'autumn-fixture',
        productVersionId: 'autumn-fixture-v1',
        name: { hr: 'Jesenski kutak' },
        description: { hr: 'Kupljeni ukrasi za vrt.' },
        previews: [
            'https://vrt.gredice.com/assets/arrangements/harvest-corner.png',
        ],
        purchasedAt: '2026-09-20T12:00:00.000Z',
        state: 'partially-used',
        remainingQuantity: 2,
        totalQuantity: 3,
        lines: [
            {
                lineId: 'pumpkins',
                entityId: '801',
                modelName: 'HarvestPumpkinSquatOrange',
                variant: null,
                quantity: 3,
                remainingQuantity: 2,
                availableUnitOrdinals: [3, 2],
            },
        ],
    };
}
