import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isGreenhouseSowingRecommended } from './greenhouseSowingRecommendation';

function plantWithGreenhouseCalendar(
    propagating: { start: number; end: number }[],
) {
    return {
        calendar: {
            harvest: [],
            propagating,
        },
    };
}

describe('greenhouse sowing recommendation', () => {
    it('matches the selected date against the indoor sowing calendar', () => {
        const plant = plantWithGreenhouseCalendar([{ start: 2.5, end: 4 }]);

        assert.equal(
            isGreenhouseSowingRecommended(plant, new Date(2026, 1, 10)),
            false,
        );
        assert.equal(
            isGreenhouseSowingRecommended(plant, new Date(2026, 1, 20)),
            true,
        );
        assert.equal(
            isGreenhouseSowingRecommended(plant, new Date(2026, 3, 30)),
            true,
        );
        assert.equal(
            isGreenhouseSowingRecommended(plant, new Date(2026, 4, 1)),
            false,
        );
    });

    it('supports indoor sowing windows that cross the year boundary', () => {
        const plant = plantWithGreenhouseCalendar([{ start: 11, end: 2 }]);

        assert.equal(
            isGreenhouseSowingRecommended(plant, new Date(2026, 0, 15)),
            true,
        );
        assert.equal(
            isGreenhouseSowingRecommended(plant, new Date(2026, 6, 15)),
            false,
        );
        assert.equal(
            isGreenhouseSowingRecommended(plant, new Date('invalid')),
            false,
        );
    });
});
