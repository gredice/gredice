import assert from 'node:assert/strict';
import test from 'node:test';
import {
    defaultSeasonState,
    getSeasonCycleMilestones,
    getSeasonLengthDays,
    getSeasonPhase,
    getSeasonStartDate,
    getSeasonState,
    resolveSeasonState,
    type Season,
    seasonCycle,
    seasonPhaseThresholds,
    seasonStartMilestones,
} from './seasonState';

const millisecondsPerDay = 24 * 60 * 60 * 1000;

function projectLocalParts(date: Date) {
    return Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds(),
        date.getMilliseconds(),
    );
}

function localDateFromProjected(timestamp: number) {
    const projected = new Date(timestamp);
    return new Date(
        projected.getUTCFullYear(),
        projected.getUTCMonth(),
        projected.getUTCDate(),
        projected.getUTCHours(),
        projected.getUTCMinutes(),
        projected.getUTCSeconds(),
        projected.getUTCMilliseconds(),
    );
}

function dateAtSeasonProgress(
    season: Season,
    cycleStartYear: number,
    progress: number,
) {
    const milestones = getSeasonCycleMilestones(cycleStartYear);
    const index = milestones.findIndex(
        (milestone) => milestone.season === season,
    );
    const start = projectLocalParts(milestones[index].start);
    const end = projectLocalParts(milestones[index + 1].start);
    return localDateFromProjected(Math.round(start + (end - start) * progress));
}

function offsetMinutes(date: Date, minutes: number) {
    return localDateFromProjected(
        projectLocalParts(date) + minutes * 60 * 1000,
    );
}

test('keeps the milestone dates in one centralized table', () => {
    assert.deepEqual(
        [...seasonCycle],
        ['winter', 'spring', 'summer', 'autumn'],
    );
    assert.deepEqual(seasonStartMilestones, {
        autumn: { monthIndex: 8, day: 22 },
        spring: { monthIndex: 2, day: 20 },
        summer: { monthIndex: 5, day: 21 },
        winter: { monthIndex: 11, day: 21 },
    });
    assert.deepEqual(getSeasonStartDate('spring', 2026), new Date(2026, 2, 20));
    assert.deepEqual(getSeasonStartDate('autumn', 2026), new Date(2026, 8, 22));
    assert.deepEqual(
        getSeasonCycleMilestones(2025).map(({ season, start }) => [
            season,
            start.getTime(),
        ]),
        [
            ['winter', new Date(2025, 11, 21).getTime()],
            ['spring', new Date(2026, 2, 20).getTime()],
            ['summer', new Date(2026, 5, 21).getTime()],
            ['autumn', new Date(2026, 8, 22).getTime()],
            ['winter', new Date(2026, 11, 21).getTime()],
        ],
    );
});

test('starts every season on its milestone date without a neutral snap back', () => {
    for (const { season, start } of getSeasonCycleMilestones(2025)) {
        const opening = getSeasonState(start);
        const closing = getSeasonState(offsetMinutes(start, -1));

        assert.equal(opening.season, season);
        assert.equal(opening.progress, 0);
        assert.equal(opening.phase, 'early');
        assert.notEqual(closing.season, season);
        assert.equal(closing.phase, 'late');
        assert.ok(closing.progress > 0.999);
        assert.ok(closing.progress < 1);
    }
});

test('hands over between seasons without a year phase discontinuity', () => {
    for (const { start } of getSeasonCycleMilestones(2025).slice(1, -1)) {
        const before = getSeasonState(offsetMinutes(start, -1));
        const after = getSeasonState(start);
        const yearPhaseStep = after.yearPhase - before.yearPhase;

        assert.ok(yearPhaseStep > 0);
        assert.ok(yearPhaseStep < 0.0001);
    }
});

test('wraps the year phase only at the winter solstice', () => {
    const before = getSeasonState(new Date(2026, 11, 20, 23, 59));
    const after = getSeasonState(new Date(2026, 11, 21, 0, 0));

    assert.equal(before.season, 'autumn');
    assert.equal(before.phase, 'late');
    assert.ok(before.yearPhase > 0.999);
    assert.equal(after.season, 'winter');
    assert.equal(after.yearPhase, 0);
    // The wrap is circular: the distance across it stays a single minute.
    assert.ok(1 - before.yearPhase + after.yearPhase < 0.0001);
});

test('keeps the calendar new year inside a continuous winter', () => {
    const lastMinute = getSeasonState(new Date(2026, 11, 31, 23, 59));
    const firstMinute = getSeasonState(new Date(2027, 0, 1, 0, 0));

    assert.equal(lastMinute.season, 'winter');
    assert.equal(firstMinute.season, 'winter');
    assert.ok(firstMinute.progress > lastMinute.progress);
    assert.ok(firstMinute.progress - lastMinute.progress < 0.0002);
    assert.ok(firstMinute.yearPhase - lastMinute.yearPhase < 0.0002);
});

test('reports mid-season progress for every season', () => {
    for (const season of seasonCycle) {
        const midSeason = getSeasonState(
            dateAtSeasonProgress(season, 2025, 0.5),
        );

        assert.equal(midSeason.season, season);
        assert.equal(midSeason.phase, 'mid');
        assert.ok(Math.abs(midSeason.progress - 0.5) < 0.001);
    }

    const midAutumn = getSeasonState(dateAtSeasonProgress('autumn', 2025, 0.5));
    // Autumn opens 275 days into the 365 day cycle, so its midpoint sits at 320/365.
    assert.ok(Math.abs(midAutumn.yearPhase - 320 / 365) < 0.001);
});

test('labels the early, mid and late phases from the shared thresholds', () => {
    assert.equal(getSeasonPhase(0), 'early');
    assert.equal(getSeasonPhase(seasonPhaseThresholds.mid - 0.0001), 'early');
    assert.equal(getSeasonPhase(seasonPhaseThresholds.mid), 'mid');
    assert.equal(getSeasonPhase(seasonPhaseThresholds.late - 0.0001), 'mid');
    assert.equal(getSeasonPhase(seasonPhaseThresholds.late), 'late');
    assert.equal(getSeasonPhase(1), 'late');
    assert.equal(getSeasonPhase(Number.NaN), 'early');

    for (const [progress, phase] of [
        [0.1, 'early'],
        [0.5, 'mid'],
        [0.9, 'late'],
    ] as const) {
        assert.equal(
            getSeasonState(dateAtSeasonProgress('autumn', 2025, progress))
                .phase,
            phase,
        );
    }
});

test('stretches the winter of a leap cycle by a day', () => {
    assert.equal(getSeasonLengthDays('winter', 2025), 89);
    assert.equal(getSeasonLengthDays('spring', 2025), 93);
    assert.equal(getSeasonLengthDays('summer', 2025), 93);
    assert.equal(getSeasonLengthDays('autumn', 2025), 90);
    assert.equal(getSeasonLengthDays('winter', 2027), 90);

    const leapDay = getSeasonState(new Date(2028, 1, 29, 12, 0));
    const before = getSeasonState(new Date(2028, 1, 28, 12, 0));
    const after = getSeasonState(new Date(2028, 2, 1, 12, 0));

    assert.equal(leapDay.season, 'winter');
    assert.ok(leapDay.progress > before.progress);
    assert.ok(leapDay.progress < after.progress);
    assert.ok(Math.abs(leapDay.progress - before.progress - 1 / 90) < 0.0001);
});

test('advances continuously across a whole cycle', () => {
    const cycleStart = getSeasonStartDate('winter', 2025);
    const cycleDays = Math.round(
        (projectLocalParts(getSeasonStartDate('winter', 2026)) -
            projectLocalParts(cycleStart)) /
            millisecondsPerDay,
    );
    const observedSeasons: Season[] = [];
    let previous = getSeasonState(cycleStart);

    assert.equal(cycleDays, 365);

    for (let day = 1; day < cycleDays; day++) {
        const current = getSeasonState(
            localDateFromProjected(
                projectLocalParts(cycleStart) + day * millisecondsPerDay,
            ),
        );

        assert.ok(current.yearPhase > previous.yearPhase);
        assert.ok(current.yearPhase - previous.yearPhase < 0.004);
        assert.ok(current.progress >= 0 && current.progress < 1);

        if (current.season === previous.season) {
            assert.ok(current.progress > previous.progress);
        } else {
            // A season change hands over from a full previous season.
            assert.ok(previous.progress > 0.98);
            assert.ok(current.progress < 0.02);
            observedSeasons.push(current.season);
        }

        previous = current;
    }

    assert.deepEqual(observedSeasons, ['spring', 'summer', 'autumn']);
});

test('resolves dates far outside the current year', () => {
    for (const date of [
        new Date(1900, 0, 15),
        new Date(1988, 6, 4),
        new Date(2200, 9, 31),
    ]) {
        const state = getSeasonState(date);

        assert.ok(seasonCycle.includes(state.season));
        assert.ok(Number.isFinite(state.progress));
        assert.ok(state.progress >= 0 && state.progress < 1);
        assert.ok(state.yearPhase >= 0 && state.yearPhase < 1);
    }

    assert.equal(getSeasonState(new Date(1900, 0, 15)).season, 'winter');
    assert.equal(getSeasonState(new Date(1988, 6, 4)).season, 'summer');
    assert.equal(getSeasonState(new Date(2200, 9, 31)).season, 'autumn');
});

test('falls back predictably for an unreadable date', () => {
    for (const date of [
        new Date(Number.NaN),
        new Date('not-a-date'),
        new Date(''),
    ]) {
        const state = getSeasonState(date);

        assert.deepEqual(state, defaultSeasonState);
        assert.ok(Number.isFinite(state.progress));
        assert.ok(Number.isFinite(state.yearPhase));
    }

    assert.deepEqual(defaultSeasonState, {
        phase: 'early',
        progress: 0,
        season: 'winter',
        yearPhase: 0,
    });
});

test('keeps the previous state object while nothing moves', () => {
    const date = new Date(2026, 9, 15, 12, 0);
    const initial = getSeasonState(date);

    assert.equal(resolveSeasonState(date, initial), initial);
    assert.deepEqual(resolveSeasonState(date, null), initial);
    assert.notEqual(
        resolveSeasonState(new Date(2026, 9, 15, 12, 1), initial),
        initial,
    );
    assert.equal(
        resolveSeasonState(new Date(Number.NaN), initial).season,
        defaultSeasonState.season,
    );
});
