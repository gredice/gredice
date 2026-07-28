'use client';

import dynamic from 'next/dynamic';
import type { GardenOverview2DProps } from './GardenOverview2DWrapper';
import { GardenLoadingIndicator } from './indicators/GardenLoadingIndicator';

export type { GardenOverview2DProps } from './GardenOverview2DWrapper';

const GardenOverview2DInner = dynamic(
    () =>
        import('./GardenOverview2DWrapper').then(
            (module) => module.GardenOverview2DWrapper,
        ),
    {
        loading: () => <GardenLoadingIndicator />,
        ssr: false,
    },
);

export function GardenOverview2DDynamic(props: GardenOverview2DProps) {
    return <GardenOverview2DInner {...props} />;
}
