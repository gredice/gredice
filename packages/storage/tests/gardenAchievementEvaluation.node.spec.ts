import assert from 'node:assert/strict';
import test from 'node:test';
import {
    gardenFamilyAchievementPlans,
    mapGardenAchievementCommands,
} from '../src/helpers/gardenAchievementEvaluation';
import { knownEventTypes } from '../src/repositories/events/knownEventTypes';

const recordedAt = new Date('2026-09-01T10:00:00.000Z');
// Still August in Zagreb, immediately before the autumn boundary.
const sowedAt = new Date('2026-08-31T21:30:00.000Z');
const harvestedAt = new Date('2026-08-31T21:45:00.000Z');

const sources = [
    {
        name: 'legacy status',
        type: knownEventTypes.raisedBedFields.plantUpdate,
        dateKey: 'effectiveDate',
        aggregateId: '8|0',
        plantings: [],
    },
    {
        name: 'selected lifecycle status',
        type: knownEventTypes.raisedBedPlantings.lifecycleStatusChanged,
        dateKey: 'effectiveAt',
        aggregateId: 'selected-1',
        plantings: [
            {
                eventAggregateId: 'selected-1',
                plantSortId: 11,
                raisedBedId: 8,
                configurationSource: 'selected' as const,
            },
        ],
    },
];

for (const source of sources) {
    test(`${source.name} uses effective dates for seasonal awards and cycle completion`, () => {
        const input = {
            raisedBedAccountId: new Map([[8, 'acc']]),
            plantIdBySortId: new Map([[11, 101]]),
            plantings: source.plantings,
            events: [
                {
                    id: 1,
                    type: source.type,
                    aggregateId: source.aggregateId,
                    createdAt: recordedAt,
                    data: {
                        status: 'sowed',
                        [source.dateKey]: sowedAt.toISOString(),
                    },
                },
                {
                    id: 2,
                    type: source.type,
                    aggregateId: source.aggregateId,
                    createdAt: recordedAt,
                    data: {
                        status: 'harvested',
                        [source.dateKey]: harvestedAt.toISOString(),
                    },
                },
            ],
        };
        assert.deepEqual(
            mapGardenAchievementCommands(input)
                .filter((command) => command.kind !== 'start')
                .map((command) => [command.kind, command.at]),
            [
                ['sow', sowedAt],
                ['harvest', harvestedAt],
            ],
        );
        assert.deepEqual(
            gardenFamilyAchievementPlans(input).map((plan) => [
                plan.definition.key,
                plan.earnedAt,
            ]),
            [
                ['seed_to_table_1', harvestedAt],
                ['season_2026_summer', sowedAt],
            ],
        );
    });

    test(`${source.name} falls back to recorded dates for missing or invalid timestamps`, () => {
        for (const value of [undefined, null, '', 'invalid', 42, {}]) {
            const commands = mapGardenAchievementCommands({
                raisedBedAccountId: new Map([[8, 'acc']]),
                plantings: source.plantings,
                events: ['sowed', 'harvested'].map((status, index) => ({
                    id: index + 1,
                    type: source.type,
                    aggregateId: source.aggregateId,
                    createdAt: recordedAt,
                    data: { status, [source.dateKey]: value },
                })),
            });
            assert.deepEqual(
                commands
                    .filter((command) => command.kind !== 'start')
                    .map((command) => command.at),
                [recordedAt, recordedAt],
            );
        }
    });
}

test('selected compatibility harvest uses the legacy effective date', () => {
    const commands = mapGardenAchievementCommands({
        raisedBedAccountId: new Map([[8, 'acc']]),
        plantings: sources[1].plantings,
        events: [
            {
                id: 1,
                type: knownEventTypes.raisedBedPlantings.taskCompleted,
                aggregateId: 'selected-1',
                createdAt: sowedAt,
                data: { status: 'sowed' },
            },
            {
                id: 2,
                type: knownEventTypes.raisedBedFields.plantUpdate,
                aggregateId: 'selected-1',
                createdAt: recordedAt,
                data: {
                    status: 'harvested',
                    effectiveDate: harvestedAt.toISOString(),
                },
            },
        ],
    });
    assert.deepEqual(commands.at(-1), {
        kind: 'harvest',
        cycleId: 'selected:selected-1',
        at: harvestedAt,
    });
});

test('first evaluation stores each crossed threshold with its historical date', () => {
    const cycles = Array.from({ length: 300 }, (_, index) => ({
        plantSortId: index + 1,
        sowedAt: new Date(Date.UTC(2025, 0, 1, 0, index)),
        harvestedAt: new Date(Date.UTC(2025, 6, 1, 0, index)),
    }));
    const plans = gardenFamilyAchievementPlans({
        raisedBedAccountId: new Map([[8, 'acc']]),
        plantIdBySortId: new Map(
            cycles.map((cycle) => [cycle.plantSortId, cycle.plantSortId]),
        ),
        plantings: [],
        events: cycles.flatMap((cycle, index) => [
            {
                id: index * 3 + 1,
                type: knownEventTypes.raisedBedFields.plantPlace,
                aggregateId: `8|${index}`,
                createdAt: cycle.sowedAt,
                data: { plantSortId: cycle.plantSortId },
            },
            {
                id: index * 3 + 2,
                type: knownEventTypes.raisedBedFields.plantUpdate,
                aggregateId: `8|${index}`,
                createdAt: cycle.sowedAt,
                data: { status: 'sowed' },
            },
            {
                id: index * 3 + 3,
                type: knownEventTypes.raisedBedFields.plantUpdate,
                aggregateId: `8|${index}`,
                createdAt: cycle.harvestedAt,
                data: { status: 'harvested' },
            },
        ]),
    });
    assert.equal(plans.length, 20);
    for (const plan of plans) {
        const threshold = plan.definition.threshold;
        assert.ok(threshold);
        assert.equal(plan.progressValue, threshold);
        assert.equal(plan.accountId, 'acc');
        const cycle = cycles[threshold - 1];
        assert.ok(cycle);
        assert.deepEqual(
            plan.earnedAt,
            plan.definition.category === 'garden_diversity'
                ? cycle.sowedAt
                : cycle.harvestedAt,
        );
    }
});
