import { useEffect, useMemo } from 'react';
import { createAutumnFoliageGeometry } from '../scene/autumnFoliageGeometry';

export function useAutumnFoliageGeometry(
    ...[source, fullCanopy, base, progress, seed]: Parameters<
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
            ),
        [source, fullCanopy, base, progress, seed],
    );
    useEffect(() => () => geometry.dispose(), [geometry]);
    return geometry;
}
