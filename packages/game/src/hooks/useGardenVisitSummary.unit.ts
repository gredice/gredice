import assert from 'node:assert/strict';
import test from 'node:test';
import {
    formatGardenVisitSummaryFacts,
    type GardenVisitSummaryFact,
} from './gardenVisitSummary';

function fact({
    count,
    id,
    occurredAt = '2026-06-10T10:00:00.000Z',
    plantName,
    priority = 50,
    range,
    target,
    type,
    visualHint,
}: {
    count?: number;
    id: string;
    occurredAt?: string;
    plantName?: string;
    priority?: number;
    range?: GardenVisitSummaryFact['range'];
    target?: GardenVisitSummaryFact['target'];
    type: GardenVisitSummaryFact['type'];
    visualHint?: GardenVisitSummaryFact['visualHint'];
}): GardenVisitSummaryFact {
    return {
        id,
        type,
        priority,
        occurredAt,
        confidence: 'high',
        source: {
            type: 'plantLifecycle',
            id,
            observedAt: occurredAt,
        },
        plant: plantName
            ? {
                  plantName,
              }
            : undefined,
        count,
        range,
        target,
        visualHint,
    };
}

test('formatGardenVisitSummaryFacts formats plant growth in concise Croatian copy', () => {
    const [item] = formatGardenVisitSummaryFacts([
        fact({
            id: 'growth-1',
            type: 'plantGrowth',
            plantName: 'Rajčica',
            priority: 70,
        }),
    ]);

    assert.equal(item?.message, 'Rajčice su vidljivo narasle.');
});

test('formatGardenVisitSummaryFacts pluralizes dry soil raised bed counts', () => {
    assert.equal(
        formatGardenVisitSummaryFacts([
            fact({ id: 'dry-1', type: 'drySoil', visualHint: 'raisedBed' }),
        ])[0]?.message,
        'Tlo je suho na 1 gredici.',
    );
    assert.equal(
        formatGardenVisitSummaryFacts([
            fact({ id: 'dry-1', type: 'drySoil', visualHint: 'raisedBed' }),
            fact({ id: 'dry-2', type: 'drySoil', visualHint: 'raisedBed' }),
        ])[0]?.message,
        'Tlo je suho na 2 gredice.',
    );
    assert.equal(
        formatGardenVisitSummaryFacts([
            fact({
                id: 'dry-5',
                type: 'drySoil',
                count: 5,
                visualHint: 'raisedBed',
            }),
        ])[0]?.message,
        'Tlo je suho na 5 gredica.',
    );
});

test('formatGardenVisitSummaryFacts pluralizes weed field counts and keeps targets', () => {
    const [item] = formatGardenVisitSummaryFacts([
        fact({
            id: 'weed-1',
            type: 'weed',
            count: 4,
            target: { raisedBedId: 10, fieldId: 20, positionIndex: 3 },
            visualHint: 'field',
            priority: 90,
        }),
    ]);

    assert.equal(item?.message, 'Pojavio se korov na 4 polja.');
    assert.equal(item?.targets.length, 1);
    assert.equal(item?.targets[0]?.fieldId, 20);
});

test('formatGardenVisitSummaryFacts formats support needs with plant names', () => {
    const [item] = formatGardenVisitSummaryFacts([
        fact({
            id: 'support-1',
            type: 'supportNeeded',
            plantName: 'Krastavac',
            priority: 90,
        }),
    ]);

    assert.equal(item?.message, 'Krastavci trebaju potporu.');
});

test('formatGardenVisitSummaryFacts formats harvest estimates and ready plants', () => {
    const estimate = formatGardenVisitSummaryFacts([
        fact({
            id: 'harvest-1',
            type: 'harvestWindow',
            plantName: 'Rajčica',
            range: { min: 3, max: 5, unit: 'days' },
            priority: 60,
        }),
    ]);
    const ready = formatGardenVisitSummaryFacts([
        fact({
            id: 'harvest-2',
            type: 'harvestWindow',
            plantName: 'Rajčica',
            range: { min: 0, max: 0, unit: 'days' },
            priority: 80,
        }),
    ]);

    assert.equal(estimate[0]?.message, 'Berba bi mogla biti za 3-5 dana.');
    assert.equal(ready[0]?.message, 'Rajčice su spremne za berbu.');
});

test('formatGardenVisitSummaryFacts formats completed operations', () => {
    const single = formatGardenVisitSummaryFacts([
        fact({ id: 'operation-1', type: 'operationCompleted' }),
    ]);
    const several = formatGardenVisitSummaryFacts([
        fact({ id: 'operation-1', type: 'operationCompleted' }),
        fact({ id: 'operation-2', type: 'operationCompleted' }),
        fact({ id: 'operation-3', type: 'operationCompleted' }),
    ]);
    const many = formatGardenVisitSummaryFacts([
        fact({ id: 'operation-5', type: 'operationCompleted', count: 5 }),
    ]);

    assert.equal(single[0]?.message, 'Dovršena je radnja u vrtu.');
    assert.equal(several[0]?.message, 'Dovršene su 3 radnje u vrtu.');
    assert.equal(many[0]?.message, 'Dovršeno je 5 radnji u vrtu.');
});

test('formatGardenVisitSummaryFacts returns ordered mobile-sized display items', () => {
    const items = formatGardenVisitSummaryFacts(
        [
            fact({
                id: 'operation-1',
                type: 'operationCompleted',
                priority: 50,
            }),
            fact({ id: 'growth-1', type: 'plantGrowth', priority: 70 }),
            fact({ id: 'harvest-1', type: 'harvestWindow', priority: 80 }),
            fact({ id: 'support-1', type: 'supportNeeded', priority: 90 }),
            fact({ id: 'dry-1', type: 'drySoil', priority: 95 }),
            fact({ id: 'weed-1', type: 'weed', priority: 100 }),
        ],
        { maxItems: 5 },
    );

    assert.equal(items.length, 5);
    assert.deepEqual(
        items.map((item) => item.type),
        ['weed', 'drySoil', 'supportNeeded', 'harvestWindow', 'plantGrowth'],
    );
});
