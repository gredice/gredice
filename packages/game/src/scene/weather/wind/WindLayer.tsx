'use client';

import { useEffect } from 'react';
import { useWeatherFrame } from '../WeatherFrameContext';
import { calmPlantWind, setPlantWind } from './plantWind';
import { WindLeaves } from './WindLeaves';
import { WindSwooshes } from './WindSwooshes';

/**
 * Wind (GAME_ART.md "Weather > Wind"), one wind scale everywhere: curly
 * swooshes in free sky, a few tumbling leaves, and plant sway from the
 * blended live wind class (published to `plantWind.ts` for the plants,
 * which render outside the weather frame). Swooshes and leaves are off in
 * the avatar views; plants keep swaying there.
 */
export function WindLayer() {
    const frame = useWeatherFrame();
    const { windClass, windDirection } = frame.amounts;
    const reducedMotion = frame.reducedMotion;

    useEffect(() => {
        setPlantWind({
            windClass,
            directionDegrees: windDirection,
            reducedMotion,
        });
    }, [reducedMotion, windClass, windDirection]);
    useEffect(() => () => setPlantWind(calmPlantWind), []);

    if (frame.cameraMode !== 'orthographic') {
        return null;
    }
    return (
        <>
            <WindSwooshes frame={frame} />
            <WindLeaves frame={frame} />
        </>
    );
}
