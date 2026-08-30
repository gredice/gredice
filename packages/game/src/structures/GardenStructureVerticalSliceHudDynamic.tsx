'use client';

import dynamic from 'next/dynamic';
import type { GardenStructureVerticalSliceHudProps } from './GardenStructureVerticalSliceHud';

const GardenStructureVerticalSliceHud = dynamic(
    () =>
        import('./GardenStructureVerticalSliceHud').then(
            (module) => module.GardenStructureVerticalSliceHud,
        ),
    {
        loading: () => (
            <output aria-live="polite" className="sr-only">
                Učitavanje načina gradnje…
            </output>
        ),
        ssr: false,
    },
);

/** Keeps the editor, catalogue, and mutation client out of the default HUD chunk. */
export function GardenStructureVerticalSliceHudDynamic(
    props: GardenStructureVerticalSliceHudProps,
) {
    return <GardenStructureVerticalSliceHud {...props} />;
}
