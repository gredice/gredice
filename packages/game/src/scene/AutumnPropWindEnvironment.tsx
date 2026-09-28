import { useLayoutEffect } from 'react';
import { useAutumnPropWind } from './AutumnPropWindProvider';

/** Receives exactly the blended weather used by the existing autumn layers. */
export function AutumnPropWindEnvironment({
    speed,
    direction,
    snow,
    enabled,
}: {
    speed: number;
    direction: number;
    snow: number;
    enabled: boolean;
}) {
    const context = useAutumnPropWind();
    useLayoutEffect(() => {
        context?.setWeather({ speed, direction, snow, enabled });
        return () =>
            context?.setWeather({
                speed: 0,
                direction: 0,
                snow: 0,
                enabled: false,
            });
    }, [context, speed, direction, snow, enabled]);
    return null;
}
