// Northern-hemisphere seasons for the current product geography
// (`defaultGameLocation` in ../utils/timeOfDay). Every seasonal effect reads the
// state resolved here through the game state slice so a frozen debug date keeps
// the scene deterministic. This is unrelated to `winterMode`, which is a content
// toggle rather than a date-derived state.

export type Season = 'winter' | 'spring' | 'summer' | 'autumn';

export type SeasonPhase = 'early' | 'mid' | 'late';

export type SeasonState = {
    /** Coarse label for debug UI and fixtures. */
    phase: SeasonPhase;
    /** Position inside the active season, from 0 at its start to 1 at its end. */
    progress: number;
    season: Season;
    /**
     * Position inside the seasonal cycle, 0 at the winter solstice milestone and
     * wrapping back to 0 at the next one. Effects that must not reset on a
     * season boundary drive their curves from this continuous value.
     */
    yearPhase: number;
};

/** Seasons in cycle order. The cycle opens at the winter solstice milestone. */
export const seasonCycle = ['winter', 'spring', 'summer', 'autumn'] as const;

/**
 * Astronomical season starts for the northern hemisphere. This table is the only
 * place the milestone dates are written down; debug tooling and tests read them
 * from here instead of restating the literals.
 */
export const seasonStartMilestones = {
    autumn: { monthIndex: 8, day: 22 },
    spring: { monthIndex: 2, day: 20 },
    summer: { monthIndex: 5, day: 21 },
    winter: { monthIndex: 11, day: 21 },
};

/** Progress boundaries between the early, mid and late phase labels. */
export const seasonPhaseThresholds = {
    late: 2 / 3,
    mid: 1 / 3,
};

/** Predictable fallback for dates the resolver cannot read. */
export const defaultSeasonState: SeasonState = {
    phase: 'early',
    progress: 0,
    season: 'winter',
    yearPhase: 0,
};

const millisecondsPerDay = 24 * 60 * 60 * 1000;

function clamp01(value: number) {
    return Math.min(1, Math.max(0, value));
}

function isReadableDate(date: Date) {
    return Boolean(date) && Number.isFinite(date.getTime());
}

/**
 * Local calendar parts projected onto a UTC timeline so day math stays free of
 * daylight saving jumps, matching the approach in ./perseids.
 */
function localDateTimestamp(date: Date) {
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

/** Local midnight of the day the given season starts in the given year. */
export function getSeasonStartDate(season: Season, year: number) {
    const { day, monthIndex } = seasonStartMilestones[season];
    return new Date(year, monthIndex, day);
}

function getSeasonStartTimestamp(season: Season, year: number) {
    return localDateTimestamp(getSeasonStartDate(season, year));
}

function getSeasonCycleYear(season: Season, cycleStartYear: number) {
    // Winter opens the cycle; the remaining seasons land in the next calendar year.
    return season === seasonCycle[0] ? cycleStartYear : cycleStartYear + 1;
}

/**
 * Milestone dates of one seasonal cycle, from the winter solstice of
 * `cycleStartYear` to the winter solstice that closes it.
 */
export function getSeasonCycleMilestones(cycleStartYear: number) {
    return [
        ...seasonCycle.map((season) => ({
            season,
            start: getSeasonStartDate(
                season,
                getSeasonCycleYear(season, cycleStartYear),
            ),
        })),
        {
            season: seasonCycle[0],
            start: getSeasonStartDate(seasonCycle[0], cycleStartYear + 1),
        },
    ];
}

function getSeasonCycleStarts(cycleStartYear: number) {
    return getSeasonCycleMilestones(cycleStartYear).map(
        ({ season, start }) => ({
            season,
            timestamp: localDateTimestamp(start),
        }),
    );
}

function getSeasonCycleStartYear(date: Date) {
    const year = date.getFullYear();
    return localDateTimestamp(date) >=
        getSeasonStartTimestamp(seasonCycle[0], year)
        ? year
        : year - 1;
}

/** Calendar length of one season, which leap years stretch by a day. */
export function getSeasonLengthDays(season: Season, cycleStartYear: number) {
    const starts = getSeasonCycleStarts(cycleStartYear);
    const index = starts.findIndex((entry) => entry.season === season);
    const start = starts[index];
    const end = starts[index + 1];
    if (!start || !end) {
        return 0;
    }

    return (end.timestamp - start.timestamp) / millisecondsPerDay;
}

export function getSeasonPhase(progress: number): SeasonPhase {
    if (!Number.isFinite(progress) || progress < seasonPhaseThresholds.mid) {
        return 'early';
    }

    return progress < seasonPhaseThresholds.late ? 'mid' : 'late';
}

/**
 * Resolve the seasonal state of any date. Dates outside the current year and
 * leap days resolve from their own cycle, and an unreadable date falls back to
 * `defaultSeasonState` instead of producing `NaN` progress.
 */
export function getSeasonState(date: Date): SeasonState {
    if (!isReadableDate(date)) {
        return defaultSeasonState;
    }

    const timestamp = localDateTimestamp(date);
    const starts = getSeasonCycleStarts(getSeasonCycleStartYear(date));
    const cycleStart = starts[0].timestamp;
    const cycleEnd = starts[starts.length - 1].timestamp;
    let activeIndex = 0;
    for (let index = 1; index < starts.length - 1; index++) {
        if (timestamp >= starts[index].timestamp) {
            activeIndex = index;
        }
    }

    const seasonStart = starts[activeIndex].timestamp;
    const seasonEnd = starts[activeIndex + 1].timestamp;
    const progress = clamp01(
        (timestamp - seasonStart) / (seasonEnd - seasonStart),
    );

    return {
        phase: getSeasonPhase(progress),
        progress,
        season: starts[activeIndex].season,
        yearPhase: clamp01((timestamp - cycleStart) / (cycleEnd - cycleStart)),
    };
}

export function areSeasonStatesEqual(first: SeasonState, second: SeasonState) {
    return (
        first.season === second.season &&
        first.phase === second.phase &&
        first.progress === second.progress &&
        first.yearPhase === second.yearPhase
    );
}

/**
 * Resolve the state for a scene clock reading, keeping the previous object when
 * nothing moved so subscribers of the state slice do not re-render every tick.
 */
export function resolveSeasonState(
    date: Date,
    previous?: SeasonState | null,
): SeasonState {
    const next = getSeasonState(date);
    return previous && areSeasonStatesEqual(previous, next) ? previous : next;
}
