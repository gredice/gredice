import { useEffect, useMemo } from 'react';
import { createAutumnFoliageGeometry } from '../scene/autumnFoliageGeometry';
import { useGameState } from '../useGameState';
import { useAutumnState } from './useAutumnState';

export function useAutumnFoliageGeometry(
    ...[source, fullCanopy, base, progress, seed, textureColor]: Parameters<
        typeof createAutumnFoliageGeometry
    >
) {
    // The spring freshness tint is calendar-driven like the autumn colours,
    // and off when weather visuals are disabled.
    const autumn = useAutumnState();
    const disabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const springFreshness = disabled ? 0 : autumn.springFreshness;
    const geometry = useMemo(
        () =>
            createAutumnFoliageGeometry(
                source,
                fullCanopy,
                base,
                progress,
                seed,
                textureColor,
                springFreshness,
            ),
        [
            source,
            fullCanopy,
            base,
            progress,
            seed,
            textureColor,
            springFreshness,
        ],
    );
    useEffect(() => () => geometry.dispose(), [geometry]);
    return geometry;
}
