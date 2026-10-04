import {
    createKestenijadaStacks,
    kestenijadaItems,
} from '@gredice/js/kestenijada';
import type { entityNameMap } from '../entities/entityNameMap';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import type { PublicGardenStack } from '../viewers/PublicGardenViewer';

const sceneNames = [
    'Block_Grass',
    'StoneWalkway',
    ...kestenijadaItems.map((item) => item.name),
];
// These negative identities and zero prices are display data, never published offers.
export function getKestenijadaRenderOnlyData() {
    return getLocalSandboxBlockData()
        .filter((row) => sceneNames.includes(row.information.name))
        .map((row, index) => ({
            ...row,
            id: -10000 - index,
            prices: { sunflowers: 0 },
        }));
}
export const kestenijadaStacks =
    createKestenijadaStacks() satisfies PublicGardenStack[];
// Keep runtime identity coverage at compile time without importing renderer components.
const identityCheck = [
    'Block_Grass',
    'StoneWalkway',
    'ChestnutRoastingCart',
    'GardenTeaTable',
    'AutumnBlanketBench',
    'HarvestCrateOrchard',
    'WoodenHandLantern',
] satisfies (keyof typeof entityNameMap)[];
export const kestenijadaSceneNames = identityCheck;
