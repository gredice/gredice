'use client';

import dynamic from 'next/dynamic';
import type { GardenStructureSceneLayerProps } from './GardenStructureSceneLayer';

const GardenStructureSceneLayer = dynamic(
    () =>
        import('./GardenStructureSceneLayer').then(
            (module) => module.GardenStructureSceneLayer,
        ),
    { ssr: false },
);

/** Loads the production building renderer only when a saved plan is present. */
export function GardenStructureSceneLayerDynamic(
    props: GardenStructureSceneLayerProps,
) {
    return <GardenStructureSceneLayer {...props} />;
}
