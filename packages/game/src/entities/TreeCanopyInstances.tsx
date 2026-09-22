import { autumnPaletteSeeds } from '../scene/autumnPalette';
import type { Stack } from '../types/Stack';
import { useEntityBlockInstances } from './EntityInstancesBlock';
import { TreeCanopyBatch } from './TreeCanopyBatch';

export function TreeCanopyInstances({
    stacks,
    renderSnow = true,
    snowOverlayMinCoverage = 0.02,
}: {
    stacks: Stack[] | undefined;
    renderSnow?: boolean;
    snowOverlayMinCoverage?: number;
}) {
    const instances = useEntityBlockInstances({
        name: 'Tree',
        stacks,
        yOffset: 0.5,
    });
    if (!instances?.length) return null;
    return autumnPaletteSeeds.map((palette) => (
        <TreeCanopyBatch
            key={palette}
            instances={instances}
            palette={palette}
            renderSnow={renderSnow}
            snowOverlayMinCoverage={snowOverlayMinCoverage}
        />
    ));
}
