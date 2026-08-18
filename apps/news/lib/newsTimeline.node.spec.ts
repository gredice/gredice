import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildNewsTimeline } from './newsTimeline.ts';

describe('buildNewsTimeline', () => {
    it('interleaves blog posts and changelog weeks by publication time', () => {
        const groups = buildNewsTimeline(
            [
                {
                    id: 7,
                    publishedAt: '2026-08-17T09:00:00.000Z',
                    title: 'Vrtni dnevnik',
                },
                {
                    id: 3,
                    publishedAt: '2026-07-30T12:00:00.000Z',
                    title: 'Ljetni savjeti',
                },
            ],
            [
                {
                    latestPublishedAt: '2026-08-18T08:00:00.000Z',
                    weekKey: '2026-08-17',
                },
                {
                    latestPublishedAt: '2026-08-16T18:00:00.000Z',
                    weekKey: '2026-08-10',
                },
            ],
        );

        assert.deepEqual(
            groups.map((group) => ({
                items: group.items.map((item) => item.key),
                monthKey: group.monthKey,
            })),
            [
                {
                    items: [
                        'changelog-2026-08-17',
                        'blog-7',
                        'changelog-2026-08-10',
                    ],
                    monthKey: '2026-08',
                },
                { items: ['blog-3'], monthKey: '2026-07' },
            ],
        );
    });

    it('keeps invalid dates in a final fallback group', () => {
        const groups = buildNewsTimeline(
            [{ id: 1, publishedAt: 'invalid' }],
            [],
        );

        assert.equal(groups.at(-1)?.monthKey, 'unknown');
        assert.equal(groups.at(-1)?.monthLabel, 'Bez datuma');
    });

    it('groups month boundaries in the Croatian time zone', () => {
        const groups = buildNewsTimeline(
            [{ id: 1, publishedAt: '2026-07-31T22:30:00.000Z' }],
            [],
        );

        assert.equal(groups[0]?.monthKey, '2026-08');
        assert.equal(groups[0]?.monthLabel, 'kolovoz 2026.');
    });
});
