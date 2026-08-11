import * as SunCalc from 'suncalc';
import type { GameLocation } from '../utils/timeOfDay';

const degreesToRadians = Math.PI / 180;
const moonRadiusKm = 1_737.4;
const meanSunAngularRadius = 0.2666 * degreesToRadians;

export type SolarEclipseState = {
    /** Fraction of the apparent Sun disc hidden by the Moon, from 0 to 1. */
    obscuration: number;
    /** Apparent angular radius of the Sun, in radians. */
    sunAngularRadius: number;
    /** Apparent angular radius of the Moon, in radians. */
    moonAngularRadius: number;
    /** Topocentric angular separation of the Sun and Moon, in radians. */
    angularSeparation: number;
    /** Live topocentric Moon position used to orient the visual occluder. */
    moonPosition: { altitude: number; azimuth: number };
    /** Live topocentric Sun position used to orient the visual occluder. */
    sunPosition: { altitude: number; azimuth: number };
};

export type SolarEclipseVisualScales = {
    direct: number;
    ambient: number;
    sky: number;
    sunGlow: number;
};

function clamp(value: number, minimum: number, maximum: number) {
    return Math.min(maximum, Math.max(minimum, value));
}

function clamp01(value: number) {
    return Number.isFinite(value) ? clamp(value, 0, 1) : 0;
}

function angularSeparation(
    first: { altitude: number; azimuth: number },
    second: { altitude: number; azimuth: number },
) {
    const firstAltitude = first.altitude * degreesToRadians;
    const secondAltitude = second.altitude * degreesToRadians;
    const azimuthDelta = (first.azimuth - second.azimuth) * degreesToRadians;
    const cosine =
        Math.sin(firstAltitude) * Math.sin(secondAltitude) +
        Math.cos(firstAltitude) *
            Math.cos(secondAltitude) *
            Math.cos(azimuthDelta);

    return Math.acos(clamp(cosine, -1, 1));
}

function circleOverlapArea(
    firstRadius: number,
    secondRadius: number,
    separation: number,
) {
    if (separation >= firstRadius + secondRadius) {
        return 0;
    }

    if (separation <= Math.abs(firstRadius - secondRadius)) {
        const containedRadius = Math.min(firstRadius, secondRadius);
        return Math.PI * containedRadius * containedRadius;
    }

    const separationSquared = separation * separation;
    const firstRadiusSquared = firstRadius * firstRadius;
    const secondRadiusSquared = secondRadius * secondRadius;
    const firstAngle = Math.acos(
        clamp(
            (separationSquared + firstRadiusSquared - secondRadiusSquared) /
                (2 * separation * firstRadius),
            -1,
            1,
        ),
    );
    const secondAngle = Math.acos(
        clamp(
            (separationSquared + secondRadiusSquared - firstRadiusSquared) /
                (2 * separation * secondRadius),
            -1,
            1,
        ),
    );
    const lensTerm = Math.max(
        0,
        (-separation + firstRadius + secondRadius) *
            (separation + firstRadius - secondRadius) *
            (separation - firstRadius + secondRadius) *
            (separation + firstRadius + secondRadius),
    );

    return (
        firstRadiusSquared * firstAngle +
        secondRadiusSquared * secondAngle -
        Math.sqrt(lensTerm) / 2
    );
}

function isSunAboveLocalHorizon(
    date: Date,
    location: GameLocation,
    apparentSunAltitude: number,
) {
    const times = SunCalc.getTimes(date, location.lat, location.lon);
    if (times.sunrise && times.sunset) {
        const timestamp = date.getTime();
        return (
            timestamp >= times.sunrise.getTime() &&
            timestamp <= times.sunset.getTime()
        );
    }

    return apparentSunAltitude >= 0;
}

export function getSolarEclipseState(
    date: Date,
    location: GameLocation,
): SolarEclipseState {
    const sunPosition = SunCalc.getPosition(date, location.lat, location.lon);
    const moonPosition = SunCalc.getMoonPosition(
        date,
        location.lat,
        location.lon,
    );
    const separation = angularSeparation(sunPosition, moonPosition);
    const moonAngularRadius = Math.asin(
        clamp(moonRadiusKm / moonPosition.distance, -1, 1),
    );
    const validGeometry =
        Number.isFinite(separation) &&
        Number.isFinite(moonAngularRadius) &&
        moonAngularRadius > 0;
    const visible =
        validGeometry &&
        isSunAboveLocalHorizon(date, location, sunPosition.altitude);
    const overlapArea = visible
        ? circleOverlapArea(meanSunAngularRadius, moonAngularRadius, separation)
        : 0;
    const sunDiscArea = Math.PI * meanSunAngularRadius * meanSunAngularRadius;

    return {
        obscuration: clamp01(overlapArea / sunDiscArea),
        sunAngularRadius: meanSunAngularRadius,
        moonAngularRadius: validGeometry ? moonAngularRadius : 0,
        angularSeparation: Number.isFinite(separation) ? separation : 0,
        moonPosition: {
            altitude: moonPosition.altitude,
            azimuth: moonPosition.azimuth,
        },
        sunPosition: {
            altitude: sunPosition.altitude,
            azimuth: sunPosition.azimuth,
        },
    };
}

export function getSolarEclipseVisualScales(
    obscuration: number,
): SolarEclipseVisualScales {
    const amount = clamp01(obscuration);
    const cubicAmount = amount * amount * amount;

    return {
        direct: 1 - 0.97 * amount,
        ambient: 1 - 0.82 * cubicAmount,
        sky: 1 - 0.72 * cubicAmount,
        sunGlow: 1 - 0.92 * amount,
    };
}
