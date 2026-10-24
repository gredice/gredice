import { createPumpkinTrailStacks } from '@gredice/js/pumpkinTrail';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import type { PublicGardenStack } from '../viewers/PublicGardenViewer';

export const pumpkinTrailStacks =
    createPumpkinTrailStacks() satisfies PublicGardenStack[];
const names = new Set(
    pumpkinTrailStacks.flatMap((stack) =>
        stack.blocks.map((block) => block.name),
    ),
);
export function getPumpkinTrailRenderOnlyData() {
    const local = getLocalSandboxBlockData();
    const template = local.find(
        (row) => row.information.name === 'FriendlyGhost',
    );
    if (!template) throw new Error('Missing trail display metadata');
    const hay = {
        ...template,
        information: {
            ...template.information,
            name: 'BaleHey',
            label: 'Bala sijena',
        },
        slug: 'trail-display-hay',
        attributes: {
            ...template.attributes,
            height: 0.7,
            hitboxHeight: 0.7,
            spanWidth: 1,
            spanDepth: 1,
        },
    };
    // BaleHey is not offered by the local sandbox. Keep its display identity in this private renderer cache only.
    return [...local.filter((row) => names.has(row.information.name)), hay].map(
        (row, i) => ({
            ...row,
            id: -12000 - i,
            prices: { sunflowers: 0 },
        }),
    );
}
