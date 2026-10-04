import type { BlockData } from '@gredice/directory-types';
import { resolveGardenPackLineVariant } from '@gredice/js/gardenPackAppearanceVariant';
import type { GardenPackProductSnapshot } from '@gredice/storage/gardenPackContract';
import { isBlockPurchaseAvailableNow } from './nightOnlyBlockPurchases';

export { resolveGardenPackLineVariant };

// Explicit decorations already registered in entityNameMap; additions need review.
const eligibleModels = new Set([
    'GardenScarecrow',
    'HarvestCrate',
    'HarvestCrateOrchard',
    'HarvestWheelbarrow',
    'BaleHey',
    'HarvestPumpkinSquatOrange',
    'HarvestPumpkinSquatCream',
    'HarvestPumpkinSquatGreen',
    'HarvestPumpkinGourdOrange',
    'HarvestPumpkinGourdCream',
    'HarvestPumpkinGourdGreen',
    'HarvestPumpkinGroupOrange',
    'HarvestPumpkinGroupCream',
    'HarvestPumpkinGroupGreen',
    'AutumnAsterPotMauve',
    'AutumnAsterPotCream',
    'AutumnAsterPotGold',
    'AutumnShrub',
    'SeasonalMaple',
    'WoodlandMushrooms',
    'FallenLog',
    'StoneMedium',
    'AutumnBlanketBench',
    'ChestnutRoastingCart',
    'LeafRake',
    'StackedFirewood',
    'SeedDryingRack',
    'GardenBrazier',
    'GardenTeaTable',
    'AutumnLeafPileMound',
    'AutumnLeafPileCrescent',
    'AutumnGrassTuft',
    'AutumnSeedHeads',
    'WoodlandAcorns',
    'WoodlandConkers',
    'WoodlandMushroomBasket',
    'AutumnWreathPost',
    'AutumnGarland',
    'PumpkinLanternSmile',
    'PumpkinLanternWink',
    'FriendlyGhost',
    'SupportedCobweb',
    'RoofTileLantern',
    'WickerGardenLantern',
    'WoodenHandLantern',
    'EnamelGardenLamp',
    'WoodenSign',
    'WoodenBench',
]);
export function isGardenPackModelEligible(modelName: string) {
    return eligibleModels.has(modelName);
}

export function assertGardenPackPurchaseContents(
    snapshot: GardenPackProductSnapshot,
    blocks: readonly BlockData[],
    now: Date,
) {
    for (const line of snapshot.lines) {
        const byId = blocks.filter(
            (block) => block.id.toString() === line.entityId,
        );
        const byName = blocks.filter(
            (block) => block.information.name === line.modelName,
        );
        const block = byId[0];
        if (
            !block ||
            byId.length !== 1 ||
            byName.length !== 1 ||
            byName[0] !== block ||
            !isGardenPackModelEligible(line.modelName) ||
            block.entityType?.name !== 'block' ||
            block.attributes?.type !== 'decoration' ||
            block.functions?.raisedBed !== false ||
            block.functions?.recycler !== false
        )
            throw new Error(
                'Pack contains an unsupported or unavailable decoration',
            );
        resolveGardenPackLineVariant(line);
        // Same ordinary-item sale rule as purchaseGardenBlockService: positive price.
        const individualPrice = block.prices?.sunflowers;
        if (
            !Number.isSafeInteger(individualPrice) ||
            (individualPrice ?? 0) <= 0 ||
            !isBlockPurchaseAvailableNow({ block, currentTime: now })
        )
            throw new Error('Pack contains a decoration not purchasable now');
    }
}
