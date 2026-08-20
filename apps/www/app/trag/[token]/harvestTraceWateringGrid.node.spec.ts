import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildHarvestTraceWateringGrid,
    formatHarvestTraceWateringDayKey,
} from './wateringGridModel.ts';

test('watering grid spans complete Monday-to-Sunday weeks across the trace', () => {
    const weeks = buildHarvestTraceWateringGrid([
        {
            occurredAt: '2026-05-06T12:00:00',
            operationCategoryName: 'sowing',
        },
        {
            occurredAt: '2026-05-12T12:00:00',
            operationCategoryName: 'harvest',
        },
    ]);

    assert.equal(weeks.length, 2);
    assert.equal(weeks[0]?.key, '2026-05-04');
    assert.equal(weeks[1]?.days.at(-1)?.key, '2026-05-17');
    assert.equal(weeks[0]?.days[1]?.isInTraceRange, false);
    assert.equal(weeks[0]?.days[2]?.isInTraceRange, true);
    assert.equal(weeks[1]?.days[2]?.isInTraceRange, false);
});

test('watering grid aggregates same-day watering counts and scales intensity', () => {
    const weeks = buildHarvestTraceWateringGrid([
        {
            occurredAt: '2026-05-04T08:00:00',
            operationCategoryName: 'watering',
        },
        {
            occurredAt: '2026-05-04T16:00:00',
            operationCategoryName: 'watering',
            operationCount: 2,
        },
        {
            occurredAt: '2026-05-05T08:00:00',
            operationCategoryName: 'watering',
        },
        {
            occurredAt: '2026-05-06T08:00:00',
            operationCategoryName: 'photographyUpdate',
            operationCount: 20,
        },
    ]);
    const days = weeks.flatMap((week) => week.days);
    const mayFourth = days.find((day) => day.key === '2026-05-04');
    const mayFifth = days.find((day) => day.key === '2026-05-05');
    const maySixth = days.find((day) => day.key === '2026-05-06');

    assert.deepEqual(
        { count: mayFourth?.count, intensity: mayFourth?.intensity },
        { count: 3, intensity: 4 },
    );
    assert.deepEqual(
        { count: mayFifth?.count, intensity: mayFifth?.intensity },
        { count: 1, intensity: 2 },
    );
    assert.deepEqual(
        { count: maySixth?.count, intensity: maySixth?.intensity },
        { count: 0, intensity: 0 },
    );
});

test('watering grid ignores invalid dates without losing valid trace days', () => {
    const weeks = buildHarvestTraceWateringGrid([
        {
            occurredAt: 'not-a-date',
            operationCategoryName: 'watering',
        },
        {
            occurredAt: '2026-05-10T12:00:00',
            operationCategoryName: 'watering',
        },
    ]);

    assert.equal(weeks.length, 1);
    assert.equal(
        formatHarvestTraceWateringDayKey(weeks[0]?.days[6]?.date ?? new Date()),
        '2026-05-10',
    );
});
