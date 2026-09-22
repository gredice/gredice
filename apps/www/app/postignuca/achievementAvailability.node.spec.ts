import assert from 'node:assert/strict';
import test from 'node:test';
import { achievementAvailability } from './achievementAvailability';

test('ordinary achievements remain available across years', () => {
    assert.equal(
        achievementAvailability('planting_500', new Date('2027-01-01')),
        'Uvijek dostupno',
    );
});

test('season availability changes at Zagreb midnight, including DST', () => {
    for (const [key, before, start, end] of [
        [
            'season_2026_spring',
            '2026-02-28T22:59:59Z',
            '2026-02-28T23:00:00Z',
            '2026-05-31T22:00:00Z',
        ],
        [
            'season_2026_summer',
            '2026-05-31T21:59:59Z',
            '2026-05-31T22:00:00Z',
            '2026-08-31T22:00:00Z',
        ],
        [
            'season_2026_autumn',
            '2026-08-31T21:59:59Z',
            '2026-08-31T22:00:00Z',
            '2026-11-30T23:00:00Z',
        ],
    ]) {
        assert.equal(
            achievementAvailability(key, new Date(before)),
            'Sezona tek dolazi',
        );
        assert.equal(
            achievementAvailability(key, new Date(start)),
            'Dostupno ove sezone',
        );
        assert.equal(
            achievementAvailability(key, new Date(new Date(end).getTime() - 1)),
            'Dostupno ove sezone',
        );
        assert.equal(
            achievementAvailability(key, new Date(end)),
            'Sezona je završila',
        );
        assert.equal(
            achievementAvailability(key, new Date('2027-09-22')),
            'Sezona je završila',
        );
    }
});
