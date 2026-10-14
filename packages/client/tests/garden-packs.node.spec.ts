import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { purchaseGardenPack } from '../src/garden-packs';

test('pack purchases preserve server errors and tolerate non-JSON failures', async () => {
    const originalFetch = globalThis.fetch;
    try {
        for (const [body, expected] of [
            ['Unauthorized', 'Kupnju paketa trenutačno nije moguće dovršiti.'],
            [
                '<html>Unavailable</html>',
                'Kupnju paketa trenutačno nije moguće dovršiti.',
            ],
            ['null', 'Kupnju paketa trenutačno nije moguće dovršiti.'],
            ['{"error":"Nedovoljno suncokreta."}', 'Nedovoljno suncokreta.'],
        ]) {
            globalThis.fetch = async () => new Response(body, { status: 401 });
            await assert.rejects(
                purchaseGardenPack({
                    operationId: randomUUID(),
                    expectedAccountId: randomUUID(),
                    productId: 'test-pack',
                    quote: {
                        productVersionId: 'test-pack:v1',
                        chargedSunflowers: 10,
                        currency: 'sunflower',
                    },
                }),
                (error: unknown) =>
                    error instanceof Error && error.message === expected,
            );
        }
    } finally {
        globalThis.fetch = originalFetch;
    }
});
