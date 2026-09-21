import * as SunCalc from 'suncalc';
import { ALWAYS_DAY_TIME } from './dayNightCycle';

const sunriseValue = 0.2;
const sunsetValue = 0.8;
const minutesPerDay = 24 * 60;
const fallbackSunriseHour = 6;
const fallbackSunsetHour = 18;

export const defaultGameLocation = { lat: 45.739, lon: 16.572 };

export type GameLocation = {
    lat: number;
    lon: number;
};

export function clampTimeOfDay(timeOfDay: number) {
    return Math.min(1, Math.max(0, timeOfDay));
}

function dateToMinutes(date: Date) {
    return date.getHours() * 60 + date.getMinutes();
}

function createDateAtHour(date: Date, hour: number) {
    const nextDate = new Date(date);
    nextDate.setHours(hour, 0, 0, 0);
    return nextDate;
}

export function getGameSunriseSunset(
    { lat, lon }: GameLocation,
    currentTime: Date,
) {
    const { sunrise, sunset } = SunCalc.getTimes(currentTime, lat, lon);

    return {
        sunrise: sunrise ?? createDateAtHour(currentTime, fallbackSunriseHour),
        sunset: sunset ?? createDateAtHour(currentTime, fallbackSunsetHour),
    };
}

/**
 * Get the current time of day based on the current date and location.
 *
 * Uses suncalc sunrise/sunset times and maps them to the stylized 0-1 game
 * range where 0.2 is sunrise and 0.8 is sunset.
 */
export function getGameTimeOfDay(location: GameLocation, currentTime: Date) {
    const { sunrise: sunriseStart, sunset: sunsetStart } = getGameSunriseSunset(
        location,
        currentTime,
    );

    const sunrise = dateToMinutes(sunriseStart);
    const sunset = dateToMinutes(sunsetStart);
    const time = dateToMinutes(currentTime);

    if (time < sunrise) {
        return sunrise > 0 ? (time / sunrise) * sunriseValue : 0;
    }

    if (time < sunset) {
        return (
            sunriseValue +
            ((time - sunrise) / (sunset - sunrise)) *
                (sunsetValue - sunriseValue)
        );
    }

    return (
        sunsetValue +
        ((time - sunset) / (minutesPerDay - sunset)) * (1 - sunsetValue)
    );
}

export function resolveGameTimeOfDay(
    currentTime: Date,
    dayNightCycleDisabled: boolean,
    location: GameLocation = defaultGameLocation,
) {
    return dayNightCycleDisabled
        ? ALWAYS_DAY_TIME
        : getGameTimeOfDay(location, currentTime);
}

export function createDateForGameTimeOfDay(
    currentDate: Date,
    timeOfDay: number,
    location: GameLocation = defaultGameLocation,
) {
    const clampedTimeOfDay = clampTimeOfDay(timeOfDay);
    const nextDate = new Date(currentDate);
    const { sunrise, sunset } = getGameSunriseSunset(location, nextDate);
    const sunriseMinutes = dateToMinutes(sunrise);
    const sunsetMinutes = dateToMinutes(sunset);

    let minutes: number;
    if (clampedTimeOfDay < sunriseValue) {
        minutes =
            sunriseMinutes > 0
                ? (clampedTimeOfDay / sunriseValue) * sunriseMinutes
                : 0;
    } else if (clampedTimeOfDay < sunsetValue) {
        minutes =
            sunriseMinutes +
            ((clampedTimeOfDay - sunriseValue) / (sunsetValue - sunriseValue)) *
                (sunsetMinutes - sunriseMinutes);
    } else {
        minutes =
            sunsetMinutes +
            ((clampedTimeOfDay - sunsetValue) / (1 - sunsetValue)) *
                (minutesPerDay - sunsetMinutes);
    }

    const clampedMinutes = Math.min(
        minutesPerDay - 1,
        Math.max(0, Math.round(minutes)),
    );
    nextDate.setHours(
        Math.floor(clampedMinutes / 60),
        clampedMinutes % 60,
        0,
        0,
    );
    return nextDate;
}

const daysPerCommonYear = 365;
const daysPerLeapYear = 366;
const millisecondsPerDay = minutesPerDay * 60 * 1000;

function isReadableDate(date: Date) {
    return Boolean(date) && Number.isFinite(date.getTime());
}

export function isGameLeapYear(year: number) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Days the given calendar year holds, 366 in a leap year. */
export function getGameYearLengthDays(year: number) {
    return isGameLeapYear(year) ? daysPerLeapYear : daysPerCommonYear;
}

/**
 * Day of the year for a date, 1 on 1 January. Local calendar parts are projected
 * onto a UTC timeline so the count never drifts across a daylight saving jump.
 */
export function getGameDayOfYear(date: Date) {
    if (!isReadableDate(date)) {
        return 1;
    }

    const yearStart = Date.UTC(date.getFullYear(), 0, 1);
    const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.round((day - yearStart) / millisecondsPerDay) + 1;
}

/** Wraps a day index into the given year so scrubbing past 31 December returns to 1 January. */
function wrapDayOfYear(dayOfYear: number, yearLengthDays: number) {
    const rounded = Math.round(dayOfYear);
    return (((rounded - 1) % yearLengthDays) + yearLengthDays) % yearLengthDays;
}

/**
 * Move a date to another day of the calendar while keeping its clock time.
 *
 * This is the debug scene date override counterpart of
 * {@link createDateForGameTimeOfDay}: that one rewrites the clock for a
 * normalized time of day, this one rewrites the calendar date and leaves the
 * clock alone. The clock time is preserved rather than the time of day, because
 * sunrise and sunset shift through the year - scrubbing from June to December
 * must keep 18:00 at 18:00 instead of dragging the sun back to where noon sat in
 * June. Year, month and day are set in a single call so a short target month
 * cannot overflow into the next one (31 March to 15 February stays in February).
 *
 * Feed the result to `setFreezeTime` so `timeOfDay`, `sunriseTime`, `sunsetTime`
 * and the season slice are all recomputed from the one scene clock.
 */
export function createDateForGameDate(currentDate: Date, targetDate: Date) {
    if (!isReadableDate(currentDate)) {
        return new Date(Number.NaN);
    }
    if (!isReadableDate(targetDate)) {
        return new Date(currentDate);
    }

    const nextDate = new Date(currentDate);
    nextDate.setFullYear(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate(),
    );
    return nextDate;
}

/**
 * Move a date to a day of the year while keeping its clock time, so a debug
 * control can scrub the scene across the whole year.
 *
 * The day index is resolved against the target year, so leap years land on the
 * right calendar date without drifting by a day (day 60 is 29 February in a leap
 * year and 1 March otherwise). Indexes outside the year wrap inside that same
 * year, keeping a scrub continuous at the year boundary instead of jumping the
 * scene into another year.
 */
export function createDateForGameDayOfYear(
    currentDate: Date,
    dayOfYear: number,
    year?: number,
) {
    if (!isReadableDate(currentDate)) {
        return new Date(Number.NaN);
    }
    if (!Number.isFinite(dayOfYear)) {
        return new Date(currentDate);
    }

    const targetYear =
        year !== undefined && Number.isFinite(year)
            ? Math.trunc(year)
            : currentDate.getFullYear();
    const wrappedDayOfYear = wrapDayOfYear(
        dayOfYear,
        getGameYearLengthDays(targetYear),
    );

    const targetDate = new Date(currentDate);
    // January plus the day offset normalizes into the right month for us, and
    // keeps two digit years out of the 1900s that `new Date(year, ...)` maps to.
    targetDate.setFullYear(targetYear, 0, 1 + wrappedDayOfYear);
    return targetDate;
}
