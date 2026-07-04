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
