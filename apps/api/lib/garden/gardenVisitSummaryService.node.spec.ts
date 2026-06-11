import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    generateGardenVisitSummaryFacts,
    hashGardenVisitSummaryFacts,
} from './gardenVisitSummaryService';

const window = {
    since: new Date('2026-06-01T08:00:00.000Z'),
    until: new Date('2026-06-04T08:00:00.000Z'),
};

const garden = {
    id: 1,
    raisedBeds: [
        {
            id: 10,
            name: 'Sjeverna gredica',
            fields: [
                {
                    id: 100,
                    positionIndex: 0,
                    active: true,
                    plantSortId: 501,
                    plantStatus: 'sprouted',
                    plantGrowthDate: new Date('2026-06-02T08:00:00.000Z'),
                },
                {
                    id: 101,
                    positionIndex: 1,
                    active: true,
                    plantSortId: 502,
                    plantStatus: 'ready',
                    plantReadyDate: new Date('2026-06-03T08:00:00.000Z'),
                },
            ],
        },
        {
            id: 11,
            name: 'Južna gredica',
            fields: [],
        },
    ],
};

const plantSorts = [
    {
        id: 501,
        information: {
            name: 'rajcica',
            label: 'Rajčica',
            plant: { id: 401, information: { name: 'Rajčica' } },
        },
    },
    {
        id: 502,
        information: {
            name: 'krastavac',
            label: 'Krastavac',
            plant: { id: 402, information: { name: 'Krastavac' } },
        },
    },
];

describe('generateGardenVisitSummaryFacts', () => {
    it('returns no facts without a previous visit marker', () => {
        assert.deepEqual(
            generateGardenVisitSummaryFacts({
                garden,
                plantSorts,
                window: { since: null, until: window.until },
            }),
            [],
        );
    });

    it('generates deterministic plant lifecycle facts from real dates', () => {
        const facts = generateGardenVisitSummaryFacts({
            garden,
            plantSorts,
            window,
        });

        assert.equal(facts.length, 2);
        assert.deepEqual(
            facts.map((fact) => fact.type),
            ['harvestWindow', 'plantGrowth'],
        );
        assert.equal(facts[0].target?.fieldId, 101);
        assert.equal(facts[0].plant?.sortName, 'Krastavac');
        assert.equal(facts[1].target?.fieldId, 100);
        assert.equal(facts[1].plant?.plantName, 'Rajčica');
        assert.equal(hashGardenVisitSummaryFacts(facts)?.length, 32);
    });

    it('includes completed operation facts tied to their targets', () => {
        const facts = generateGardenVisitSummaryFacts({
            garden,
            plantSorts,
            window,
            operations: [
                {
                    id: 900,
                    entityId: 700,
                    entityTypeName: 'operation',
                    status: 'completed',
                    raisedBedId: 10,
                    raisedBedFieldId: 100,
                    completedAt: new Date('2026-06-02T10:00:00.000Z'),
                },
            ],
        });

        const operationFact = facts.find(
            (fact) => fact.type === 'operationCompleted',
        );
        assert.ok(operationFact);
        assert.equal(operationFact.operation?.id, 900);
        assert.equal(operationFact.target?.fieldId, 100);
    });

    it('omits dry soil without confident sensor or weather-backed source data', () => {
        assert.equal(
            generateGardenVisitSummaryFacts({
                garden,
                plantSorts,
                window,
            }).some((fact) => fact.type === 'drySoil'),
            false,
        );
    });

    it('emits dry soil only when a real moisture reading is below threshold', () => {
        const facts = generateGardenVisitSummaryFacts({
            garden,
            plantSorts,
            window,
            soilMoisture: [
                {
                    raisedBedId: 10,
                    moisturePercent: 24,
                    observedAt: new Date('2026-06-03T09:00:00.000Z'),
                    sourceId: 'sensor:10:2026-06-03',
                },
                {
                    raisedBedId: 11,
                    moisturePercent: 40,
                    observedAt: new Date('2026-06-03T09:00:00.000Z'),
                    sourceId: 'sensor:11:2026-06-03',
                },
            ],
        });

        const dryFacts = facts.filter((fact) => fact.type === 'drySoil');
        assert.equal(dryFacts.length, 1);
        assert.equal(dryFacts[0].target?.raisedBedId, 10);
    });

    it('omits weeds until stored weed state exists', () => {
        assert.equal(
            generateGardenVisitSummaryFacts({
                garden,
                plantSorts,
                window,
            }).some((fact) => fact.type === 'weed'),
            false,
        );
    });

    it('uses stored weed state without fabricating counts', () => {
        const facts = generateGardenVisitSummaryFacts({
            garden: {
                ...garden,
                raisedBeds: [
                    {
                        ...garden.raisedBeds[0],
                        weedState: {
                            level: 'heavy',
                            observedAt: new Date('2026-06-02T09:00:00.000Z'),
                            eventId: 300,
                        },
                    },
                    garden.raisedBeds[1],
                ],
            },
            plantSorts,
            window,
        });

        const weedFact = facts.find((fact) => fact.type === 'weed');
        assert.ok(weedFact);
        assert.equal(weedFact.count, 1);
        assert.equal(weedFact.source.id, '300');
    });

    it('emits support facts only from explicit operation-backed support data', () => {
        const facts = generateGardenVisitSummaryFacts({
            garden,
            plantSorts,
            window,
            supportNeeds: [
                {
                    raisedBedId: 10,
                    raisedBedName: 'Sjeverna gredica',
                    fieldId: 100,
                    positionIndex: 0,
                    plantSortId: 501,
                    observedAt: new Date('2026-06-02T09:00:00.000Z'),
                    sourceId: 'operation-rule:700',
                },
            ],
        });

        const supportFact = facts.find((fact) => fact.type === 'supportNeeded');
        assert.ok(supportFact);
        assert.equal(supportFact.plant?.sortName, 'Rajčica');
        assert.equal(supportFact.target?.fieldId, 100);
    });

    it('expresses harvest estimates as a day range', () => {
        const facts = generateGardenVisitSummaryFacts({
            garden,
            plantSorts,
            window,
            harvestWindows: [
                {
                    raisedBedId: 10,
                    raisedBedName: 'Sjeverna gredica',
                    fieldId: 102,
                    positionIndex: 2,
                    plantSortId: 502,
                    earliestDate: new Date('2026-06-06T08:00:00.000Z'),
                    latestDate: new Date('2026-06-08T08:00:00.000Z'),
                    sourceId: 'harvest-window:101',
                },
            ],
        });

        const harvestFact = facts.find(
            (fact) =>
                fact.type === 'harvestWindow' &&
                fact.source.type === 'harvestWindow',
        );
        assert.ok(harvestFact);
        assert.deepEqual(harvestFact.range, {
            min: 2,
            max: 4,
            unit: 'days',
        });
    });

    it('caps, sorts, and dedupes facts by user value', () => {
        const facts = generateGardenVisitSummaryFacts({
            garden,
            plantSorts,
            window,
            maxFacts: 3,
            soilMoisture: [
                {
                    raisedBedId: 10,
                    moisturePercent: 24,
                    observedAt: new Date('2026-06-03T09:00:00.000Z'),
                    sourceId: 'sensor:10:first',
                },
                {
                    raisedBedId: 10,
                    moisturePercent: 22,
                    observedAt: new Date('2026-06-03T10:00:00.000Z'),
                    sourceId: 'sensor:10:second',
                },
            ],
            operations: [
                {
                    id: 900,
                    entityId: 700,
                    entityTypeName: 'operation',
                    status: 'completed',
                    raisedBedId: 10,
                    completedAt: new Date('2026-06-02T10:00:00.000Z'),
                },
            ],
        });

        assert.equal(facts.length, 3);
        assert.deepEqual(
            facts.map((fact) => fact.type),
            ['drySoil', 'harvestWindow', 'plantGrowth'],
        );
        assert.equal(facts[0].source.id, 'sensor:10:second');
    });
});
