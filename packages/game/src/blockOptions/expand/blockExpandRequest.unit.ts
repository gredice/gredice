import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    GardenBlockBatchRequestError,
    parseGardenBlockBatchPurchaseBody,
} from '@gredice/client';
import {
    BlockExpandPlanChangedError,
    blockExpandPlacementsEqual,
    buildBlockExpandRequestBody,
    resolveBlockExpandFailure,
    withBlockSunflowerPrice,
} from './blockExpandRequest';

const operationId = '8b0f6f3e-5a0c-4d6e-9f64-2d6f0c1b7a11';
const placements = [
    { position: { x: 2, y: -4 }, expectedExistingBlocks: [] },
    {
        position: { x: 1, y: -3 },
        expectedExistingBlocks: ['ground:1:-3', 'flower'],
    },
];

function body(
    overrides: Partial<Parameters<typeof buildBlockExpandRequestBody>[0]> = {},
) {
    return buildBlockExpandRequestBody({
        blockName: 'Block_Grass',
        isSandbox: false,
        operationId,
        placements,
        rotation: 0,
        unitPrice: 10,
        ...overrides,
    });
}

describe('buildBlockExpandRequestBody', () => {
    it('builds a body the contract schema accepts', () => {
        const request = body();
        assert.deepEqual(request, {
            operationId,
            blockName: 'Block_Grass',
            rotation: 0,
            expectedUnitPrice: 10,
            placements: [
                { position: { x: 2, y: -4 }, expectedExistingBlocks: [] },
                {
                    position: { x: 1, y: -3 },
                    expectedExistingBlocks: ['ground:1:-3', 'flower'],
                },
            ],
        });
        assert.deepEqual(parseGardenBlockBatchPurchaseBody(request), request);
    });

    it('sends expectedUnitPrice 0 in a sandbox garden', () => {
        assert.equal(
            body({ isSandbox: true, unitPrice: 25 }).expectedUnitPrice,
            0,
        );
        assert.equal(body({ unitPrice: 25 }).expectedUnitPrice, 25);
    });

    it('normalizes the source rotation to quarter turns', () => {
        assert.equal(body({ rotation: 5 }).rotation, 1);
        assert.equal(body({ rotation: -1 }).rotation, 3);
        assert.equal(body({ rotation: null }).rotation, 0);
        assert.equal(body({ rotation: undefined }).rotation, 0);
        assert.equal(body({ rotation: 7 }).rotation, 3);
    });

    it('copies placements instead of sharing the plan arrays', () => {
        const request = body();
        assert.notEqual(
            request.placements[1]?.expectedExistingBlocks,
            placements[1]?.expectedExistingBlocks,
        );
        assert.notEqual(
            request.placements[0]?.position,
            placements[0]?.position,
        );
    });
});

describe('blockExpandPlacementsEqual', () => {
    it('matches the same cells and stacks in the same order', () => {
        assert.equal(
            blockExpandPlacementsEqual(placements, body().placements),
            true,
        );
    });

    it('detects a changed stack, cell, order or count', () => {
        const changedStack = [
            placements[0],
            {
                position: { x: 1, y: -3 },
                expectedExistingBlocks: ['ground:1:-3'],
            },
        ].filter((placement) => placement !== undefined);
        assert.equal(
            blockExpandPlacementsEqual(placements, changedStack),
            false,
        );
        assert.equal(
            blockExpandPlacementsEqual(placements, [...placements].reverse()),
            false,
        );
        assert.equal(
            blockExpandPlacementsEqual(placements, placements.slice(0, 1)),
            false,
        );
        assert.equal(
            blockExpandPlacementsEqual(placements, [
                { position: { x: 3, y: -4 }, expectedExistingBlocks: [] },
                ...placements.slice(1),
            ]),
            false,
        );
    });
});

describe('resolveBlockExpandFailure', () => {
    function requestError(
        status: number,
        code: string,
        details: ConstructorParameters<
            typeof GardenBlockBatchRequestError
        >[3] = {},
    ) {
        return new GardenBlockBatchRequestError(status, code, 'error', details);
    }

    it('keeps uncertain failures pending and refreshes garden and account', () => {
        for (const error of [
            requestError(0, 'NETWORK_ERROR'),
            requestError(401, 'UNAUTHORIZED'),
            requestError(403, 'FORBIDDEN'),
            requestError(408, 'TIMEOUT'),
            requestError(429, 'TOO_MANY'),
            requestError(500, 'OPERATION_FAILED'),
            requestError(500, 'INVALID_RECEIPT'),
            requestError(503, 'BLOCK_DIRECTORY_UNAVAILABLE'),
        ]) {
            const result = resolveBlockExpandFailure(error);
            assert.equal(result.outcome, 'uncertain', error.code);
            assert.equal(result.uncertain, true);
            assert.equal(
                result.message,
                'Potvrda nije stigla. Provjeri isti zahtjev; suncokreti se neće naplatiti dvaput.',
            );
            assert.deepEqual(result.refresh, {
                garden: true,
                account: true,
                blockData: false,
            });
        }
    });

    it('maps definitive codes to messages and refreshes', () => {
        const conflict = resolveBlockExpandFailure(
            requestError(409, 'GARDEN_STATE_CHANGED', {
                conflicts: [{ index: 2, reason: 'stack-changed' }],
            }),
        );
        assert.equal(conflict.outcome, 'conflict');
        assert.equal(conflict.uncertain, false);
        assert.equal(
            conflict.message,
            'Vrt se promijenio. Pregled je osvježen, provjeri broj blokova i potvrdi ponovno.',
        );
        assert.equal(conflict.refresh.garden, true);

        const price = resolveBlockExpandFailure(
            requestError(409, 'PRICE_CHANGED', { unitPrice: 15 }),
        );
        assert.equal(price.outcome, 'price_changed');
        assert.equal(
            price.message,
            'Cijena se promijenila. Provjeri novi iznos i potvrdi ponovno.',
        );
        // The server's price replaces the cached one; the directory is not
        // refetched, because the HTTP cache could serve the old price.
        assert.equal(price.unitPrice, 15);
        assert.equal(price.refresh.blockData, false);
        const priceWithoutDetails = resolveBlockExpandFailure(
            requestError(409, 'PRICE_CHANGED', {}),
        );
        assert.equal(priceWithoutDetails.unitPrice, null);
        assert.equal(priceWithoutDetails.refresh.blockData, true);
        // Only a changed price carries a price to use.
        assert.equal(
            resolveBlockExpandFailure(
                requestError(400, 'INSUFFICIENT_SUNFLOWERS', { unitPrice: 9 }),
            ).unitPrice,
            null,
        );

        const insufficient = resolveBlockExpandFailure(
            requestError(400, 'INSUFFICIENT_SUNFLOWERS', {
                affordableCount: 4,
                availableAmount: 40,
                requiredAmount: 60,
            }),
        );
        assert.equal(insufficient.outcome, 'insufficient');
        // The server's count is from the raw balance, not the HUD balance
        // (balance minus the cart) the bar counts with, so none is shown.
        assert.equal(insufficient.message, 'Nedovoljno suncokreta.');
        assert.equal(insufficient.refresh.account, true);

        const rateLimited = resolveBlockExpandFailure(
            requestError(429, 'RATE_LIMITED', { retryAfterSeconds: 120 }),
        );
        assert.equal(rateLimited.outcome, 'rate_limited');
        assert.equal(rateLimited.uncertain, false);
        assert.equal(
            rateLimited.message,
            'Previše proširivanja u kratkom vremenu. Pokušaj ponovno za nekoliko minuta.',
        );

        assert.equal(
            resolveBlockExpandFailure(
                requestError(400, 'BLOCK_NOT_PURCHASABLE_NOW'),
            ).message,
            'Dostupno samo noću.',
        );
        assert.equal(
            resolveBlockExpandFailure(requestError(400, 'BLOCK_NOT_FOR_SALE'))
                .message,
            'Ovaj predmet se ne prodaje.',
        );
        assert.equal(
            resolveBlockExpandFailure(
                requestError(400, 'BLOCK_NOT_EXPANDABLE', { reason: 'animal' }),
            ).message,
            'Ovaj predmet se ne može proširiti.',
        );
        assert.equal(
            resolveBlockExpandFailure(
                requestError(400, 'EXPANSION_AREA_TOO_LARGE', { maxSide: 10 }),
            ).message,
            'Područje je preveliko. Smanji ga i potvrdi ponovno.',
        );

        const other = resolveBlockExpandFailure(
            requestError(409, 'OPERATION_CONFLICT'),
        );
        assert.equal(other.outcome, 'failed');
        assert.equal(other.uncertain, false);
        assert.equal(
            other.message,
            'Postavljanje nije uspjelo. Pokušaj ponovno.',
        );
    });

    it('treats a changed plan and local errors as definitive', () => {
        const changed = resolveBlockExpandFailure(
            new BlockExpandPlanChangedError(),
        );
        assert.equal(changed.outcome, 'conflict');
        assert.equal(changed.uncertain, false);
        assert.deepEqual(changed.refresh, {
            garden: false,
            account: false,
            blockData: false,
        });

        const local = resolveBlockExpandFailure(new Error('No garden'));
        assert.equal(local.outcome, 'failed');
        assert.equal(local.uncertain, false);
    });
});

describe('withBlockSunflowerPrice', () => {
    const grass = {
        information: { name: 'Block_Grass' },
        prices: { sunflowers: 10 },
    };
    const sand = {
        information: { name: 'Block_Sand' },
        prices: { sunflowers: 5 },
    };

    it("replaces one block's price and keeps the other objects", () => {
        const next = withBlockSunflowerPrice([grass, sand], 'Block_Grass', 12);
        assert.deepEqual(next?.[0]?.prices, { sunflowers: 12 });
        assert.equal(next?.[1], sand);
        assert.equal(grass.prices.sunflowers, 10);
    });

    it('returns the same catalogue when nothing changes', () => {
        const blocks = [grass, sand];
        assert.equal(
            withBlockSunflowerPrice(blocks, 'Block_Grass', 10),
            blocks,
        );
        assert.equal(withBlockSunflowerPrice(blocks, 'Missing', 3), blocks);
        assert.equal(withBlockSunflowerPrice(null, 'Block_Grass', 3), null);
        assert.equal(
            withBlockSunflowerPrice(undefined, 'Block_Grass', 3),
            undefined,
        );
    });
});
