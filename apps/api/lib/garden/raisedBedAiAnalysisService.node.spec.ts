import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildPastPlantFieldsContext,
    getRaisedBedImageAnalysisWeeklyLimit,
    getWeatherHistoryDayRange,
    normalizeAnalysisReferenceDate,
} from './raisedBedAiAnalysisService';

test('getRaisedBedImageAnalysisWeeklyLimit grants 5 requests per active raised bed', () => {
    assert.strictEqual(getRaisedBedImageAnalysisWeeklyLimit(0), 0);
    assert.strictEqual(getRaisedBedImageAnalysisWeeklyLimit(1), 5);
    assert.strictEqual(getRaisedBedImageAnalysisWeeklyLimit(3), 15);
});

test('normalizeAnalysisReferenceDate parses valid dates and rejects invalid values', () => {
    const parsed = normalizeAnalysisReferenceDate('2026-05-12T12:00:00.000Z');

    assert.strictEqual(parsed?.toISOString(), '2026-05-12T12:00:00.000Z');
    assert.strictEqual(normalizeAnalysisReferenceDate('not-a-date'), null);
    assert.strictEqual(normalizeAnalysisReferenceDate(null), null);
});

test('getWeatherHistoryDayRange resolves the Zagreb local weather day', () => {
    const range = getWeatherHistoryDayRange(
        new Date('2026-05-12T12:00:00.000Z'),
    );

    assert.strictEqual(range.date, '2026-05-12');
    assert.strictEqual(range.from.toISOString(), '2026-05-11T22:00:00.000Z');
    assert.strictEqual(range.to.toISOString(), '2026-05-12T21:59:59.999Z');
});

test('buildPastPlantFieldsContext summarizes only previous plant names', () => {
    const context = buildPastPlantFieldsContext(
        [
            {
                positionIndex: 0,
                plantCycles: [
                    { plantSortId: 101, active: false },
                    { plantSortId: 102, active: false },
                    { plantSortId: 101, active: false },
                    { plantSortId: 103, active: true },
                ],
            },
            {
                positionIndex: 1,
                plantCycles: [{ plantSortId: 104, active: true }],
            },
        ],
        new Map([
            [101, 'Tomato'],
            [102, 'Lettuce'],
            [103, 'Basil'],
            [104, 'Carrot'],
        ]),
    );

    assert.deepStrictEqual(context, [
        {
            positionIndex: 0,
            positionLabel: 1,
            plantNames: ['Tomato', 'Lettuce'],
        },
    ]);
});
