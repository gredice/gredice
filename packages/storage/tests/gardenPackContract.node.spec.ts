import assert from 'node:assert/strict';
import test from 'node:test';
import {
    gardenPackProductSnapshotSchema,
    getGardenPackUnits,
    isGardenPackAvailableForPurchase,
} from '../src/gardenPackContract';

export function packSnapshot() {
    return gardenPackProductSnapshotSchema.parse({
        contractVersion: 1,
        productId: 'test-pack',
        productVersionId: 'test-pack:v1',
        name: { hr: 'Probni paket' },
        description: { hr: 'Samo testni primjer.' },
        previews: ['https://example.test/pack.webp'],
        currency: 'sunflower',
        chargedSunflowers: 11,
        publication: 'published',
        availableFrom: '2026-09-01T00:00:00Z',
        availableUntil: '2026-12-01T00:00:00Z',
        policy: {
            versionId: 'policy:v1',
            refunds: 'unused-units-paid-value',
            recycling: 'configured-per-unit-value',
            seasonExpiry: 'retain-owned-units',
            gardenDeletion: 'recycle-placed-units-once',
            accountDeletion: 'detach-owner-retain-audit',
        },
        lines: [
            {
                lineId: 'pumpkins',
                entityId: '123',
                modelName: 'TestPumpkin',
                variant: {
                    versionId: 'appearance:v1',
                    appearance: { color: 'orange' },
                },
                quantity: 2,
                paidSunflowersByUnit: [5, 6],
                recyclingSunflowersByUnit: [2, 3],
            },
        ],
    });
}

test('pack contract keeps exact integer allocations and stable ordinals', () => {
    const units = getGardenPackUnits(packSnapshot());
    assert.deepEqual(
        units.map((unit) => [
            unit.lineId,
            unit.unitOrdinal,
            unit.paidSunflowers,
            unit.recyclingSunflowers,
        ]),
        [
            ['pumpkins', 1, 5, 2],
            ['pumpkins', 2, 6, 3],
        ],
    );
});

test('contract rejects invalid quantities, duplicate lines, price drift and unconfigured policy', () => {
    const valid = packSnapshot();
    for (const snapshot of [
        { ...valid, chargedSunflowers: 10 },
        { ...valid, previews: ['ftp://example.test/pack.webp'] },
        {
            ...valid,
            lines: valid.lines.map((line) => ({
                ...line,
                entityId: 'catalogue-123',
            })),
        },
        {
            ...valid,
            lines: valid.lines.map((line) => ({
                ...line,
                entityId: '2147483648',
            })),
        },
        { ...valid, currency: 'autumn' },
        { ...valid, policy: undefined },
        { ...valid, productVersionId: '' },
        { ...valid, lines: [valid.lines[0], valid.lines[0]] },
        {
            ...valid,
            lines: valid.lines.map((line) => ({ ...line, quantity: 1 })),
        },
        {
            ...valid,
            lines: valid.lines.map((line) => ({ ...line, quantity: -1 })),
        },
        {
            ...valid,
            lines: valid.lines.map((line) => ({
                ...line,
                recyclingSunflowersByUnit: [6, 3],
            })),
        },
        { ...valid, availableUntil: valid.availableFrom },
    ])
        assert.equal(
            gardenPackProductSnapshotSchema.safeParse(snapshot).success,
            false,
        );
});

test('season availability is bounded only for new purchases', () => {
    const snapshot = packSnapshot();
    assert.equal(
        isGardenPackAvailableForPurchase(
            snapshot,
            new Date('2026-08-31T23:59:59Z'),
        ),
        false,
    );
    assert.equal(
        isGardenPackAvailableForPurchase(
            snapshot,
            new Date('2026-09-01T00:00:00Z'),
        ),
        true,
    );
    assert.equal(
        isGardenPackAvailableForPurchase(
            snapshot,
            new Date('2026-12-01T00:00:00Z'),
        ),
        false,
    );
    assert.equal(
        isGardenPackAvailableForPurchase(
            { ...snapshot, publication: 'draft' },
            new Date('2026-10-02'),
        ),
        false,
    );
    assert.equal(
        isGardenPackAvailableForPurchase(snapshot, new Date('invalid')),
        false,
    );
    assert.equal(getGardenPackUnits(snapshot).length, 2);
});
