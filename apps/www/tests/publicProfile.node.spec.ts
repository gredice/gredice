import assert from 'node:assert/strict';
import test from 'node:test';
import { formatProfileMembership } from '../app/korisnici/[publicId]/profileMembership';
import { getTopPublicAchievements } from '../app/korisnici/[publicId]/publicProfile';

test('shows only the highest approved tier in each category regardless of unlock order', () => {
    const result = getTopPublicAchievements([
        { key: 'watering_20', status: 'approved' },
        { key: 'planting_10', status: 'approved' },
        { key: 'watering_1', status: 'approved' },
        { key: 'harvest_20', status: 'approved' },
        { key: 'planting_20', status: 'approved' },
        { key: 'planting_50', status: 'pending' },
        { key: 'harvest_50', status: 'denied' },
        { key: 'harvest_1', status: 'approved' },
        { key: 'registration', status: 'approved' },
        { key: 'community_edit_1', status: 'approved' },
        { key: 'community_edit_10', status: 'approved' },
        { key: 'watering_20', status: 'approved' },
    ]);
    assert.deepEqual(
        result.map(({ key }) => key),
        [
            'registration',
            'planting_20',
            'watering_20',
            'harvest_20',
            'community_edit_10',
        ],
    );
});

test('describes membership in Croatian with calendar months, years, and days', () => {
    const now = new Date('2026-09-12T12:00:00Z');
    for (const [joined, expected] of [
        ['2026-03-12', 'Korisnik već 6 mjeseci'],
        ['2026-07-12', 'Korisnik već 2 mjeseca'],
        ['2026-08-12', 'Korisnik već 1 mjesec'],
        ['2026-08-13', 'Korisnik već 30 dana'],
        ['2026-09-11', 'Korisnik već 1 dan'],
        ['2026-09-10', 'Korisnik već 2 dana'],
        ['2026-09-01', 'Korisnik već 11 dana'],
        ['2026-08-22', 'Korisnik već 21 dan'],
        ['2025-09-12', 'Korisnik već 1 godinu'],
        ['2024-09-12', 'Korisnik već 2 godine'],
        ['2021-09-12', 'Korisnik već 5 godina'],
        ['2026-09-12', 'Korisnik od danas'],
        ['2026-09-13', 'Korisnik od danas'],
    ]) {
        assert.equal(formatProfileMembership(joined, now), expected);
    }
});

test('handles month-end anniversaries and missing join dates', () => {
    assert.equal(
        formatProfileMembership('2026-01-31', new Date('2026-02-28T12:00:00Z')),
        'Korisnik već 1 mjesec',
    );
    assert.equal(
        formatProfileMembership('2024-02-29', new Date('2025-02-28T12:00:00Z')),
        'Korisnik već 1 godinu',
    );
    assert.equal(formatProfileMembership('invalid'), null);
});

test('does not reveal pending, denied, or unknown achievements', () => {
    assert.deepEqual(
        getTopPublicAchievements([
            { key: 'planting_500', status: 'pending' },
            { key: 'harvest_500', status: 'denied' },
            { key: 'unknown-secret-achievement', status: 'approved' },
        ]),
        [],
    );
    assert.deepEqual(getTopPublicAchievements([]), []);
});
