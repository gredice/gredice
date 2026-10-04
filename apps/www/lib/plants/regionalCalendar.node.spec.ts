import assert from 'node:assert/strict';
import test from 'node:test';
import { collectRevalidationPaths } from '../../app/api/revalidate/directories/revalidationPaths.ts';
import { getCalendarRangePosition } from '../../app/biljke/calendarRangePosition.ts';
import { collectSitemapSourcePaths } from '../sitemap/sitemapSourcePaths.ts';
import {
    buildRegionalCalendar,
    filterRegionalCalendarRows,
    formatCalendarPeriod,
    getRegionalCalendarDigest,
} from './regionalCalendar.ts';
import type { RegionalCalendarReview } from './regionalCalendarReviews.ts';

const today = '2026-09-20';
const plant = {
    id: 1,
    information: { name: 'Salata' },
    calendar: {
        sowing: [
            { start: '9.5', end: '10.9' },
            { start: 2, end: 4 },
        ],
        harvest: [{ start: 11, end: 2.5 }],
    },
    prices: { perPlant: 1.99 },
};

function reviewFor(candidate = plant): RegionalCalendarReview {
    return {
        plantId: candidate.id,
        region: 'Kontinentalna Hrvatska',
        reviewer: { name: 'Testni pregledavatelj', role: 'Testni uzgajivač' },
        reviewedAt: '2026-09-01',
        reviewBefore: '2027-02-01',
        calendarDigest: getRegionalCalendarDigest(candidate.calendar),
        sources: [
            {
                label: 'Isključivo testni izvor',
                url: 'https://example.com/test',
            },
        ],
        activities: {
            propagating: null,
            planting: null,
            sowing: {
                environment: 'outdoors',
                varietyNotes: 'Testna jesenska sorta.',
                rangeIndexes: [0],
            },
            harvest: {
                environment: 'outdoors',
                varietyNotes: 'Testna zimska berba.',
                rangeIndexes: [0],
            },
        },
    };
}

test('unreviewed source dates stay unspecified even when a generic verified flag exists', () => {
    const verifiedPlant = {
        ...plant,
        information: { ...plant.information, verified: true },
    };
    const calendar = buildRegionalCalendar([verifiedPlant], [], [], today);
    assert.equal(calendar.ready, false);
    assert.equal(calendar.rows.length, 4);
    assert.ok(
        calendar.rows.every(
            (row) => !row.ranges.length && !row.months.some(Boolean),
        ),
    );
    assert.equal(calendar.crops[0].status, 'missing');
});

test('reviewed rows select existing source ranges and agree with the graphic across year boundaries', () => {
    const calendar = buildRegionalCalendar([plant], [], [reviewFor()], today);
    const sowing = calendar.rows.find((row) => row.activity === 'sowing');
    const harvest = calendar.rows.find((row) => row.activity === 'harvest');
    assert.deepEqual(sowing?.ranges, [{ start: 9.5, end: 10.9 }]);
    assert.deepEqual(harvest?.months, [
        true,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        true,
        true,
    ]);
    for (const row of calendar.rows) {
        assert.deepEqual(
            row.months,
            Array.from({ length: 12 }, (_, index) =>
                Boolean(getCalendarRangePosition(row.ranges, index + 1)),
            ),
        );
    }
    assert.equal(
        sowing?.period,
        'rujan (50 % mjeseca) – listopad (90 % mjeseca)',
    );
    assert.equal(calendar.crops[0].review?.reviewedAt, '2026-09-01');
});

test('changing source dates invalidates review; equivalent numeric strings do not', () => {
    assert.equal(
        getRegionalCalendarDigest({ sowing: [{ start: '9.5', end: '10.9' }] }),
        getRegionalCalendarDigest({ sowing: [{ start: 9.5, end: 10.9 }] }),
    );
    const changed = {
        ...plant,
        calendar: { ...plant.calendar, sowing: [{ start: 1, end: 12 }] },
    };
    const calendar = buildRegionalCalendar([changed], [], [reviewFor()], today);
    assert.equal(calendar.crops[0].status, 'changed');
    assert.ok(calendar.rows.every((row) => !row.ranges.length));
});

test('expired, future, incomplete, unsafe and invalid reviews never publish dates', () => {
    const valid = reviewFor();
    const invalid: RegionalCalendarReview[] = [
        {
            ...valid,
            activities: {
                ...valid.activities,
                sowing: {
                    environment: 'protected',
                    varietyNotes: 'Test',
                    rangeIndexes: [0],
                },
            },
        },
        { ...valid, reviewBefore: today },
        { ...valid, reviewedAt: '2026-09-21' },
        { ...valid, reviewedAt: '2026-02-30' },
        { ...valid, reviewer: { name: '', role: 'Test' } },
        { ...valid, sources: [] },
        { ...valid, sources: [{ label: 'Test', url: 'javascript:alert(1)' }] },
        {
            ...valid,
            activities: {
                ...valid.activities,
                sowing: {
                    environment: 'outdoors',
                    varietyNotes: 'Test',
                    rangeIndexes: [99],
                },
            },
        },
    ];
    for (const review of invalid) {
        const result = buildRegionalCalendar([plant], [], [review], today);
        assert.notEqual(result.crops[0].status, 'reviewed');
        assert.equal(result.crops[0].review, undefined);
        assert.ok(result.rows.every((row) => !row.months.some(Boolean)));
    }
});

test('invalid or incomplete source ranges are not clamped into recommendations', () => {
    for (const range of [
        { start: 0, end: 13 },
        { start: '3oops', end: 4 },
        { start: 2 },
        { start: '', end: 4 },
    ]) {
        const candidate = { ...plant, calendar: { sowing: [range] } };
        const review = {
            ...reviewFor(),
            calendarDigest: getRegionalCalendarDigest(candidate.calendar),
        };
        const result = buildRegionalCalendar([candidate], [], [review], today);
        assert.ok(result.rows.every((row) => !row.ranges.length));
    }
});

test('launch readiness requires all five published crops with current usable reviews', () => {
    const plants = ['Salata', 'Špinat', 'Matovilac', 'Češnjak', 'Rajčica'].map(
        (name, index) => ({ ...plant, id: index + 1, information: { name } }),
    );
    const reviews = plants.map(reviewFor);
    assert.equal(buildRegionalCalendar(plants, [], reviews, today).ready, true);
    assert.equal(
        buildRegionalCalendar(plants.slice(1), [], reviews, today).ready,
        false,
    );
    assert.equal(
        buildRegionalCalendar(plants, [], reviews.slice(1), today).ready,
        false,
    );
    assert.equal(
        buildRegionalCalendar(plants, [], reviews, '2027-02-01').ready,
        false,
    );
    const garlic = buildRegionalCalendar(plants, [], reviews, today).rows.find(
        (row) => row.slug === 'cesnjak' && row.activity === 'sowing',
    );
    assert.equal(garlic?.label, 'Sadnja češnjeva');
});

test('ordering availability is independent of calendar review and uses current varieties and prices', () => {
    const sort = {
        id: 20,
        information: { name: 'Testna sorta', plant: { id: 1 } },
        store: { availableInStore: true },
    };
    const result = buildRegionalCalendar(
        [plant],
        [
            sort,
            { ...sort, id: 21, store: { availableInStore: false } },
            { ...sort, id: 22, prices: { perPlant: Number.NaN } },
            {
                ...sort,
                id: 23,
                information: { ...sort.information, plant: { id: 99 } },
            },
        ],
        [],
        today,
    );
    assert.deepEqual(
        result.crops[0].availableSorts.map((item) => item.id),
        [20],
    );
    assert.ok(result.rows.every((row) => !row.ranges.length));
    assert.equal(
        buildRegionalCalendar(
            [{ ...plant, prices: undefined }],
            [sort],
            [],
            today,
        ).crops[0].availableSorts.length,
        0,
    );
});

test('month and activity filters intersect without changing the source rows', () => {
    const { rows } = buildRegionalCalendar([plant], [], [reviewFor()], today);
    assert.equal(
        filterRegionalCalendarRows(rows, { month: '', activity: '' }).length,
        4,
    );
    assert.deepEqual(
        filterRegionalCalendarRows(rows, { month: '1', activity: '' }).map(
            (row) => row.activity,
        ),
        ['harvest'],
    );
    assert.equal(
        filterRegionalCalendarRows(rows, { month: '1', activity: 'sowing' })
            .length,
        0,
    );
    assert.equal(
        filterRegionalCalendarRows(rows, { month: '13', activity: '' }).length,
        4,
    );
    assert.equal(formatCalendarPeriod([]), '');
});

test('sitemap gate cannot be bypassed by a conflicting CMS record', () => {
    const sources = {
        cmsPages: [
            {
                slug: 'kalendar-sjetve',
                state: 'published',
                publishedAt: today,
                noIndex: false,
            },
        ],
        publicGardens: [],
        seeds: [],
        brands: [],
    };
    assert.equal(
        collectSitemapSourcePaths(sources).includes('/kalendar-sjetve'),
        false,
    );
    assert.equal(
        collectSitemapSourcePaths({
            ...sources,
            regionalCalendarReady: true,
        }).includes('/kalendar-sjetve'),
        true,
    );
    for (const entityType of ['plant', 'plantSort']) {
        assert.ok(
            collectRevalidationPaths([
                entityType === 'plant' ? 'plant' : 'plantSort',
            ]).some((entry) => entry.path === '/kalendar-sjetve'),
        );
    }
});
