import { useEffect, useMemo } from 'react';
import { createAutumnFoliageGeometry } from '../scene/autumnFoliageGeometry';

export function useAutumnFoliageGeometry(
    ...[source, fullCanopy, base, progress, seed, textureColor]: Parameters<
        typeof createAutumnFoliageGeometry
    >
) {
    const geometry = useMemo(
        () =>
            createAutumnFoliageGeometry(
                source,
                fullCanopy,
                base,
                progress,
                seed,
                textureColor,
            ),
        [source, fullCanopy, base, progress, seed, textureColor],
    );
    useEffect(() => () => geometry.dispose(), [geometry]);
    return geometry;
}
