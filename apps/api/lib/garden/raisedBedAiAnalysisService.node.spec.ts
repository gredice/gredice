import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildAvailableOperationsContext,
    buildPastPlantFieldsContext,
    getOperationSchedulingDateOptions,
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

test('getOperationSchedulingDateOptions returns the next three Zagreb dates', () => {
    assert.deepStrictEqual(
        getOperationSchedulingDateOptions(new Date('2026-07-25T22:30:00.000Z')),
        ['2026-07-27', '2026-07-28', '2026-07-29'],
    );
});

test('buildAvailableOperationsContext excludes internal operations and embeds date placeholders', () => {
    const operations = buildAvailableOperationsContext(
        [
            {
                id: '11',
                slug: 'malciranje-gredice',
                attributes: {
                    application: 'raisedBedFull',
                    internal: false,
                },
                information: { label: 'Malčiranje gredice' },
            },
            {
                id: '12',
                slug: 'zalijevanje-biljke',
                attributes: { application: 'plant' },
                information: { label: 'Zalijevanje biljke' },
            },
            {
                id: '13',
                slug: 'interna-kontrola',
                attributes: {
                    application: 'raisedBedFull',
                    internal: true,
                },
                information: { label: 'Interna kontrola' },
            },
        ],
        101,
    );

    assert.deepStrictEqual(operations, [
        {
            id: '11',
            name: 'Malčiranje gredice',
            slug: 'malciranje-gredice',
            application: 'raisedBedFull',
            raisedBedOperationUrl:
                'https://www.gredice.com/radnje/malciranje-gredice#raisedBedId=101&scheduledDate={scheduledDate}',
            plantFieldOperationUrlTemplate: null,
        },
        {
            id: '12',
            name: 'Zalijevanje biljke',
            slug: 'zalijevanje-biljke',
            application: 'plant',
            raisedBedOperationUrl: null,
            plantFieldOperationUrlTemplate:
                'https://www.gredice.com/radnje/zalijevanje-biljke#raisedBedId=101&positionIndex={positionIndex}&scheduledDate={scheduledDate}',
        },
    ]);
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
