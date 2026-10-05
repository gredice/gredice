import assert from 'node:assert/strict';
import test from 'node:test';
import { createGardenPackPurchaseService } from './gardenPackPurchaseService';

test('service independently rejects expected-owner mismatch before any gates, reads, locks or debit', async () => {
    let accesses = 0;
    const untouched = async (): Promise<never> => {
        accesses++;
        throw new Error('Owner mismatch must not access dependencies');
    };
    const purchase = createGardenPackPurchaseService({
        isStorageEnabled: () => {
            accesses++;
            return true;
        },
        isSalesEnabled: () => true,
        isStorageReady: untouched,
        withAccountTransaction: untouched,
        readCompletedPurchase: untouched,
        readPurchase: untouched,
        grant: untouched,
        debit: untouched,
        getCatalogue: untouched,
        getBlocks: untouched,
        now: () => new Date(),
    });
    const result = await purchase('00000000-0000-4000-8000-000000000020', {
        operationId: '00000000-0000-4000-8000-000000000001',
        expectedAccountId: '00000000-0000-4000-8000-000000000010',
        productId: 'test-pack',
        quote: {
            productVersionId: 'test:v1',
            chargedSunflowers: 11,
            currency: 'sunflower',
        },
    });
    assert.deepEqual(result, {
        ok: false,
        code: 'EXPECTED_ACCOUNT_MISMATCH',
        error: 'Račun se promijenio. Vrati se na račun za ovu kupnju.',
        status: 409,
    });
    assert.equal(accesses, 0);
});
