import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    buildChangelogWeeks,
    type ChangelogWeekEntry,
    changelogWeekCanonicalUrl,
    changelogWeekImageUrl,
    findChangelogWeek,
    isChangelogWeekKey,
} from './weeklyChangelog.ts';

function entry(
    id: number,
    publishedAt: string,
    title: string,
    tags: string[] = [],
): ChangelogWeekEntry {
    return {
        excerpt: `${title} – opis`,
        id,
        publishedAt,
        slug: `promjena-${id.toString()}`,
        tags,
        title,
    };
}

describe('weekly changelog summaries', () => {
    it('groups entries by the Croatian Monday-to-Sunday week', () => {
        const weeks = buildChangelogWeeks(
            [
                entry(1, '2026-08-16T20:00:00.000Z', 'Nedjeljna promjena'),
                entry(2, '2026-08-16T22:30:00.000Z', 'Ponoćna promjena'),
            ],
            {
                includeCurrentWeek: false,
                now: new Date('2026-08-18T10:00:00.000Z'),
            },
        );

        assert.deepEqual(
            weeks.map((week) => ({
                entries: week.entries.map((item) => item.id),
                weekKey: week.weekKey,
            })),
            [
                { entries: [2], weekKey: '2026-08-17' },
                { entries: [1], weekKey: '2026-08-10' },
            ],
        );
    });

    it('always creates the current week with the more-to-come state', () => {
        const [week] = buildChangelogWeeks([], {
            now: new Date('2026-08-18T10:00:00.000Z'),
        });

        assert.ok(week);
        assert.equal(week.weekKey, '2026-08-17');
        assert.equal(week.isCurrentWeek, true);
        assert.equal(week.title, 'Ovaj tjedan u Gredicama');
        assert.match(week.description, /Nove promjene i mogućnosti stižu/u);
        assert.match(week.imageAlt, /još novosti stiže/u);
        assert.equal(week.href, '/sto-je-novo/tjedan/2026-08-17');
        assert.equal(week.publicPath, '/novosti/sto-je-novo/tjedan/2026-08-17');
        assert.equal(
            changelogWeekCanonicalUrl(week),
            'https://www.gredice.com/novosti/sto-je-novo/tjedan/2026-08-17',
        );
        assert.equal(
            changelogWeekImageUrl(week),
            'https://www.gredice.com/novosti/sto-je-novo/tjedan/2026-08-17/opengraph-image',
        );
    });

    it('builds a factual historical summary from published titles and tags', () => {
        const [week] = buildChangelogWeeks(
            [
                entry(1, '2026-08-11T08:00:00.000Z', 'Drvena staza', [
                    'Vrt',
                    'Novosti',
                ]),
                entry(3, '2026-08-15T09:00:00.000Z', 'Kamene ograde', [
                    'Uređenje',
                    'vrt',
                ]),
                entry(2, '2026-08-13T10:00:00.000Z', 'Bijela ograda', [
                    'Uređenje',
                ]),
            ],
            {
                includeCurrentWeek: false,
                now: new Date('2026-08-18T10:00:00.000Z'),
            },
        );

        assert.ok(week);
        assert.equal(week.weekKey, '2026-08-10');
        assert.equal(week.rangeLabel, '10. – 16. kolovoza 2026.');
        assert.equal(week.monthLabel, 'kolovoz 2026.');
        assert.equal(week.latestPublishedAt, '2026-08-15T09:00:00.000Z');
        assert.deepEqual(
            week.entries.map((item) => item.id),
            [3, 2, 1],
        );
        assert.deepEqual(week.tags, ['Uređenje', 'vrt']);
        assert.match(week.description, /„Kamene ograde”/u);
        assert.match(week.description, /„Bijela ograda”/u);
        assert.match(week.description, /još 1 promjena/u);
        assert.ok(week.description.length <= 160);
    });

    it('formats weeks that cross month boundaries and rejects invalid keys', () => {
        const [week] = buildChangelogWeeks(
            [entry(1, '2026-08-02T12:00:00.000Z', 'Ljetna promjena')],
            {
                includeCurrentWeek: false,
                now: new Date('2026-08-18T10:00:00.000Z'),
            },
        );

        assert.ok(week);
        assert.equal(week.weekKey, '2026-07-27');
        assert.equal(week.rangeLabel, '27. srpnja – 2. kolovoza 2026.');
        assert.equal(week.monthKey, '2026-07');
        assert.equal(isChangelogWeekKey('2026-08-17'), true);
        assert.equal(isChangelogWeekKey('2026-08-18'), false);
        assert.equal(isChangelogWeekKey('2026-02-30'), false);
        assert.equal(
            findChangelogWeek(
                [entry(1, '2026-08-18T12:00:00.000Z', 'Promjena')],
                '2026-08-18',
            ),
            null,
        );
    });
});
