import { useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { Color } from 'three';
import { RainDropField } from '../src/scene/Rain/Drops';
import {
    rainDropLook,
    resolveRainDropFallSpeed,
    resolveRainDropMotion,
    resolveRainDropOpacity,
    resolveRainDropSizePx,
} from '../src/scene/Rain/rainParticles';
import { weatherRoleSets } from '../src/scene/weather/weatherRoles';

/**
 * The shipping rain field for component fixtures that mount weather pieces
 * without the weather frame: slim midday streaks with the production size,
 * opacity and speed for `rainy`, at the given drop count.
 */
export function FixtureRainField({
    count,
    groundY = 0.4,
    rainy,
}: {
    count: number;
    groundY?: number;
    rainy: number;
}) {
    const size = useThree((state) => state.size);
    const zoom = useThree((state) => state.camera.zoom);
    const colors = useMemo(
        () => ({
            head: new Color(weatherRoleSets.midday.rainHead),
            tail: new Color(weatherRoleSets.midday.rainTail),
        }),
        [],
    );
    const pixelsPerUnit = zoom > 0 ? zoom : rainDropLook.referencePixelsPerUnit;
    const fallSpeed = resolveRainDropFallSpeed(rainy, false);
    const motion = resolveRainDropMotion({
        fallSpeed,
        halfHeight: size.height / 2 / pixelsPerUnit,
        halfWidth: size.width / 2 / pixelsPerUnit,
        pixelsPerUnit,
        slant: 0,
    });
    const dropSize = resolveRainDropSizePx(rainy);

    return (
        <RainDropField
            capacity={count}
            coreWidthPx={dropSize.coreWidthPx}
            count={count}
            fallSpeed={fallSpeed}
            fallVelocity={motion.fallVelocity}
            groundY={groundY}
            head={colors.head}
            lengthPx={dropSize.lengthPx}
            opacity={resolveRainDropOpacity(rainy)}
            quadWidthPx={dropSize.quadWidthPx}
            slant={0}
            tail={colors.tail}
            viewHeightPx={size.height}
            windVelocity={motion.windVelocity}
        />
    );
}
