import { Quaternion, Vector3 } from 'three';

const degreesToRadiansScale = Math.PI / 180;

export function degreesToRadians(degrees: number) {
    return degrees * degreesToRadiansScale;
}

export function timeOfDayToDate(currentTime: Date, timeOfDay: number) {
    const hours = Math.trunc(timeOfDay * 24);
    const minutes = Math.trunc((timeOfDay * 24 - hours) * 60);
    return new Date(
        currentTime.getFullYear(),
        currentTime.getMonth(),
        currentTime.getDate(),
        hours,
        minutes,
        0,
    );
}

// SunCalc v2 reports azimuth clockwise from north. The scene trajectory math
// expects the older SunCalc convention: 0 at south with west positive.
function sunCalcAzimuthToSceneAzimuth(azimuthDegrees: number) {
    return azimuthDegrees - 180;
}

// Maps SunCalc altitude/azimuth degrees into the stylized scene sky so both
// the visible sun/moon discs and the directional light share the same trajectory.
export function altAzToScenePosition(
    altitudeDegrees: number,
    azimuthDegrees: number,
) {
    const altitude = degreesToRadians(altitudeDegrees);
    const azimuth = degreesToRadians(
        sunCalcAzimuthToSceneAzimuth(azimuthDegrees),
    );
    const pos = new Vector3(5, 20, 0);
    const hinge = new Quaternion();
    const rotator = new Quaternion();
    rotator.setFromAxisAngle(new Vector3(0, -1, 0), altitude);
    hinge.premultiply(rotator);
    rotator.setFromAxisAngle(new Vector3(0.8, 0, 0), azimuth);
    hinge.premultiply(rotator);
    pos.applyQuaternion(hinge);
    return pos;
}
