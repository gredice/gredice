import * as SunCalc from 'suncalc';
import { degreesToRadians } from './sunPosition';

export type MoonPhaseLocation = {
    lat: number;
    lon: number;
};

export type MoonVisualPhase = {
    phase: number;
    brightLimbAngle: number;
};

export function moonBrightLimbScreenAngle({
    illuminationAngle,
    parallacticAngle,
}: {
    illuminationAngle: number;
    parallacticAngle: number;
}) {
    const zenithAngle = illuminationAngle - parallacticAngle;
    return degreesToRadians(90 + zenithAngle);
}

export function getMoonVisualPhase(
    date: Date,
    { lat, lon }: MoonPhaseLocation,
): MoonVisualPhase {
    const moon = SunCalc.getMoonPosition(date, lat, lon);
    const illumination = SunCalc.getMoonIllumination(date);

    return {
        phase: illumination.phase,
        brightLimbAngle: moonBrightLimbScreenAngle({
            illuminationAngle: illumination.angle,
            parallacticAngle: moon.parallacticAngle,
        }),
    };
}
