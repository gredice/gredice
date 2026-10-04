import type { BlockData } from '@gredice/client';
import { autumnAsterPotNames } from '@gredice/js/autumnAsterPots';
import { autumnBlanketBench } from '@gredice/js/autumnBlanketBench';
import { autumnEntranceNames } from '@gredice/js/autumnEntrances';
import { autumnGrassNames } from '@gredice/js/autumnGrasses';
import { autumnLeafPileNames } from '@gredice/js/autumnLeafPiles';
import { autumnShrub } from '@gredice/js/autumnShrub';
import { birdFeeder } from '@gredice/js/birdFeeder';
import { chestnutRoastingCart } from '@gredice/js/chestnutRoastingCart';
import { fallenLog } from '@gredice/js/fallenLog';
import { gardenBrazier } from '@gredice/js/gardenBrazier';
import { gardenScarecrow } from '@gredice/js/gardenScarecrow';
import { gardenTeaTable } from '@gredice/js/gardenTeaTable';
import { halloweenAccentNames } from '@gredice/js/halloweenAccents';
import { harvestCrateNames } from '@gredice/js/harvestCrates';
import { harvestPumpkinNames } from '@gredice/js/harvestPumpkins';
import { harvestWheelbarrow } from '@gredice/js/harvestWheelbarrow';
import { hedgehogShelterNames } from '@gredice/js/hedgehogShelter';
import { leafRake } from '@gredice/js/leafRake';
import { pumpkinLanternNames } from '@gredice/js/pumpkinLanterns';
import { seasonalMaple } from '@gredice/js/seasonalMaple';
import { seedDryingRack } from '@gredice/js/seedDryingRack';
import { stackedFirewood } from '@gredice/js/stackedFirewood';
import { woodlandArrangementNames } from '@gredice/js/woodlandArrangements';
import { woodlandMushrooms } from '@gredice/js/woodlandMushrooms';
import { isInternalSceneBlockData } from '../internalSceneBlockData';

// These are collections of ordinary individual purchases. A matching scene or
// a seasonal label never grants extra pieces or changes an item's identity.
export const autumnItemCollections = [
    {
        id: 'harvest',
        label: 'Jesenska berba',
        entityNames: [
            ...harvestPumpkinNames,
            gardenScarecrow.name,
            ...harvestCrateNames,
            harvestWheelbarrow.name,
            'BaleHey',
            'WoodenSign',
            'WickerGardenLantern',
            'WoodenWalkway',
        ],
    },
    {
        id: 'woodland',
        label: 'Šumski kutak',
        entityNames: [
            woodlandMushrooms.name,
            fallenLog.name,
            ...autumnLeafPileNames,
            ...woodlandArrangementNames,
            ...autumnGrassNames,
            autumnShrub.name,
            seasonalMaple.name,
            birdFeeder.name,
            ...hedgehogShelterNames,
            'Tree',
            'Pine',
            'DeadTreeStump',
            'StoneSmall',
            'StoneMedium',
            'WoodenWalkway',
            'StoneWalkway',
        ],
    },
    {
        id: 'evening',
        label: 'Topla večer',
        entityNames: [
            autumnBlanketBench.name,
            gardenTeaTable.name,
            'AutumnAsterPotMauve',
            stackedFirewood.name,
            gardenBrazier.name,
            'WoodenBench',
            'Stool',
            'OutletDisplayTable',
            'WickerGardenLantern',
            'WoodenHandLantern',
            'RoofTileLantern',
            'EnamelGardenLamp',
            'HazelLightArch',
            'FireflyJar',
        ],
    },
    {
        id: 'garden',
        label: 'Jesenski vrt',
        entityNames: [
            ...autumnAsterPotNames,
            autumnShrub.name,
            seasonalMaple.name,
            leafRake.name,
            seedDryingRack.name,
            ...autumnEntranceNames,
            ...autumnGrassNames,
            ...autumnLeafPileNames,
            'PotLowBowl',
            'PotRoundedBowl',
            'PotSquatRidged',
            'WoodenSign',
            'Fence',
            'FenceGate',
            'StoneWalkway',
        ],
    },
    {
        id: 'chestnuts',
        label: 'Kestenijada',
        activationEntityNames: [chestnutRoastingCart.name],
        entityNames: [
            chestnutRoastingCart.name,
            ...harvestCrateNames,
            gardenTeaTable.name,
            autumnBlanketBench.name,
            'WoodenBench',
            'WoodenHandLantern',
            'WickerGardenLantern',
            'WoodenSign',
        ],
    },
    {
        id: 'pumpkin-night',
        label: 'Noć bundeva',
        activationEntityNames: [
            ...pumpkinLanternNames,
            ...halloweenAccentNames,
        ],
        entityNames: [
            ...pumpkinLanternNames,
            ...halloweenAccentNames,
            ...harvestPumpkinNames,
            'BaleHey',
            'WickerGardenLantern',
            'WoodenSign',
        ],
    },
] satisfies {
    id:
        | 'harvest'
        | 'woodland'
        | 'evening'
        | 'garden'
        | 'chestnuts'
        | 'pumpkin-night';
    label: string;
    entityNames: string[];
    activationEntityNames?: string[];
}[];

export function getAutumnItemCollections({
    blockData,
    isSandbox,
}: {
    blockData: BlockData[] | null | undefined;
    isSandbox: boolean;
}) {
    // Public directory rows are published catalogue data. Internal fallback
    // rows exist only to render scenes; a missing/non-sale row is never a shop
    // offer. A local sandbox may preview available models without charging.
    const availableNames = new Set(
        blockData
            ?.filter(
                (block) =>
                    !isInternalSceneBlockData(block) &&
                    (isSandbox ||
                        (Number.isFinite(block.prices.sunflowers) &&
                            (block.prices.sunflowers ?? 0) > 0)),
            )
            .map((block) => block.information.name),
    );

    return autumnItemCollections.flatMap((collection) => {
        if (
            collection.activationEntityNames &&
            !collection.activationEntityNames.some((name) =>
                availableNames.has(name),
            )
        ) {
            return [];
        }

        const entityNames = collection.entityNames.filter((name) =>
            availableNames.has(name),
        );
        return entityNames.length > 0 ? [{ ...collection, entityNames }] : [];
    });
}
