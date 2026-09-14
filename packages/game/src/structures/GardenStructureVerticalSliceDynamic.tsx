'use client';

import dynamic from 'next/dynamic';
import type { GardenStructureVerticalSliceProps } from './GardenStructureVerticalSlice';

const GardenStructureVerticalSlice = dynamic(
    () =>
        import('./GardenStructureVerticalSlice').then(
            (module) => module.GardenStructureVerticalSlice,
        ),
    { ssr: false },
);

/** Loads editor-only R3F geometry only after an active preview needs it. */
export function GardenStructureVerticalSliceDynamic(
    props: GardenStructureVerticalSliceProps,
) {
    return <GardenStructureVerticalSlice {...props} />;
}
