import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    evaluateGardenAchievementProgress,
    type GardenAchievementCommand,
    thresholdReachedAt,
} from './gardenProgress';

const plantIdBySortId = new Map([
    [11, 1],
    [12, 1],
    [21, 2],
    [31, 3],
]);

function at(iso: string) {
    return new Date(iso);
}

test('counts parent plants once and ignores unresolved or unknown sorts', () => {
    const commands: GardenAchievementCommand[] = [
        {
            kind: 'start',
            cycleId: 'a',
            accountId: 'acc',
            plantSortId: 11,
            at: at('2026-04-01T10:00:00.000Z'),
        },
        {
            kind: 'sow',
            cycleId: 'a',
            at: at('2026-04-02T10:00:00.000Z'),
        },
        {
            kind: 'start',
            cycleId: 'b',
            accountId: 'acc',
            plantSortId: 12,
            at: at('2026-04-03T10:00:00.000Z'),
        },
        {
            kind: 'sow',
            cycleId: 'b',
            at: at('2026-04-04T10:00:00.000Z'),
        },
        {
            kind: 'start',
            cycleId: 'c',
            accountId: 'acc',
            plantSortId: 21,
            at: at('2026-04-05T10:00:00.000Z'),
        },
        {
            kind: 'sow',
            cycleId: 'c',
            at: at('2026-04-06T10:00:00.000Z'),
        },
        {
            kind: 'start',
            cycleId: 'd',
            accountId: 'acc',
            plantSortId: 99,
            at: at('2026-04-07T10:00:00.000Z'),
        },
        {
            kind: 'sow',
            cycleId: 'd',
            at: at('2026-04-08T10:00:00.000Z'),
        },
        {
            kind: 'start',
            cycleId: 'e',
            accountId: 'acc',
            at: at('2026-04-09T10:00:00.000Z'),
        },
        {
            kind: 'sow',
            cycleId: 'e',
            at: at('2026-04-10T10:00:00.000Z'),
        },
    ];
    const progress = evaluateGardenAchievementProgress(
        commands,
        plantIdBySortId,
    ).get('acc');
    assert.deepEqual(
        progress?.distinctPlants.map((item) => item.plantId),
        [1, 2],
    );
    assert.equal(progress?.completedCycles.length, 0);
    assert.ok(progress?.seasons.has('season_2026_spring'));
});

test('completes a cycle once and records harvest season separately from sowing', () => {
    const commands: GardenAchievementCommand[] = [
        {
            kind: 'start',
            cycleId: 'tomato',
            accountId: 'acc',
            plantSortId: 11,
            at: at('2026-04-01T10:00:00.000Z'),
        },
        {
            kind: 'sow',
            cycleId: 'tomato',
            at: at('2026-04-02T10:00:00.000Z'),
        },
        {
            kind: 'sow',
            cycleId: 'tomato',
            at: at('2026-04-03T10:00:00.000Z'),
        },
        {
            kind: 'harvest',
            cycleId: 'tomato',
            at: at('2026-07-02T10:00:00.000Z'),
        },
        {
            kind: 'harvest',
            cycleId: 'tomato',
            at: at('2026-07-20T10:00:00.000Z'),
        },
        {
            kind: 'harvest',
            cycleId: 'never-sowed',
            at: at('2026-07-21T10:00:00.000Z'),
        },
    ];
    const progress = evaluateGardenAchievementProgress(
        commands,
        plantIdBySortId,
    ).get('acc');
    assert.equal(progress?.completedCycles.length, 1);
    assert.equal(
        progress?.completedCycles[0]?.at.toISOString(),
        '2026-07-02T10:00:00.000Z',
    );
    assert.ok(progress?.seasons.has('season_2026_spring'));
    assert.ok(progress?.seasons.has('season_2026_summer'));
    assert.equal(
        progress?.seasons.get('season_2026_summer')?.toISOString(),
        '2026-07-02T10:00:00.000Z',
    );
});

test('uses the corrected sort for species identity and keeps accounts isolated', () => {
    const commands: GardenAchievementCommand[] = [
        {
            kind: 'start',
            cycleId: 'one',
            accountId: 'acc-a',
            plantSortId: 11,
            at: at('2026-04-01T10:00:00.000Z'),
        },
        {
            kind: 'setSort',
            cycleId: 'one',
            plantSortId: 31,
            at: at('2026-04-01T11:00:00.000Z'),
        },
        {
            kind: 'sow',
            cycleId: 'one',
            at: at('2026-04-02T10:00:00.000Z'),
        },
        {
            kind: 'start',
            cycleId: 'two',
            accountId: 'acc-b',
            plantSortId: 21,
            at: at('2026-04-02T10:00:00.000Z'),
        },
        {
            kind: 'sow',
            cycleId: 'two',
            at: at('2026-04-03T10:00:00.000Z'),
        },
        {
            kind: 'harvest',
            cycleId: 'two',
            at: at('2026-09-10T10:00:00.000Z'),
        },
    ];
    const byAccount = evaluateGardenAchievementProgress(
        commands,
        plantIdBySortId,
    );
    assert.deepEqual(
        byAccount.get('acc-a')?.distinctPlants.map((item) => item.plantId),
        [3],
    );
    assert.equal(byAccount.get('acc-a')?.completedCycles.length, 0);
    assert.deepEqual(
        byAccount.get('acc-b')?.distinctPlants.map((item) => item.plantId),
        [2],
    );
    assert.equal(byAccount.get('acc-b')?.completedCycles.length, 1);
    assert.ok(byAccount.get('acc-b')?.seasons.has('season_2026_autumn'));
});

test('threshold timestamps use the event that crossed the count', () => {
    const items = [
        { at: at('2026-04-01T00:00:00.000Z') },
        { at: at('2026-04-02T00:00:00.000Z') },
        { at: at('2026-04-03T00:00:00.000Z') },
    ];
    assert.equal(
        thresholdReachedAt(items, 1)?.toISOString(),
        '2026-04-01T00:00:00.000Z',
    );
    assert.equal(
        thresholdReachedAt(items, 3)?.toISOString(),
        '2026-04-03T00:00:00.000Z',
    );
    assert.equal(thresholdReachedAt(items, 4), undefined);
});
