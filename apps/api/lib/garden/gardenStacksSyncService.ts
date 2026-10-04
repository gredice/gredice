import {
    createRaisedBed,
    getGarden,
    getGardenBlocks,
    updateGardenStack,
} from '@gredice/storage';
import { updateRaisedBedsOrientation } from './raisedBedsService';

export async function synchronizeGardenStacksAndRaisedBeds(gardenId: number) {
    const [garden, blocks] = await Promise.all([
        getGarden(gardenId),
        getGardenBlocks(gardenId),
    ]);
    if (!garden) {
        return;
    }

    const validBlockIds = new Set(blocks.map((block) => block.id));
    const stacksToClean = garden.stacks.flatMap((stack) => {
        const validBlocks = stack.blocks.filter((id) => validBlockIds.has(id));
        return validBlocks.length === stack.blocks.length
            ? []
            : [{ x: stack.positionX, y: stack.positionY, validBlocks }];
    });
    await Promise.all(
        stacksToClean.map(({ x, y, validBlocks }) =>
            updateGardenStack(gardenId, { x, y, blocks: validBlocks }),
        ),
    );

    const cleanedGarden =
        stacksToClean.length > 0 ? await getGarden(gardenId) : garden;
    if (!cleanedGarden) {
        return;
    }

    const blockById = new Map(blocks.map((block) => [block.id, block]));
    const placedRaisedBedBlockIds = new Set(
        cleanedGarden.stacks.flatMap((stack) =>
            stack.blocks.filter(
                (blockId) => blockById.get(blockId)?.name === 'Raised_Bed',
            ),
        ),
    );
    const ownedRaisedBedBlockIds = new Set(
        cleanedGarden.raisedBeds.flatMap((raisedBed) =>
            raisedBed.blockId ? [raisedBed.blockId] : [],
        ),
    );
    const missingRaisedBedBlockIds = [...placedRaisedBedBlockIds].filter(
        (blockId) => !ownedRaisedBedBlockIds.has(blockId),
    );

    for (const blockId of missingRaisedBedBlockIds) {
        await createRaisedBed({
            accountId: cleanedGarden.accountId,
            blockId,
            gardenId: cleanedGarden.id,
        });
    }

    const gardenForOrientationUpdate =
        missingRaisedBedBlockIds.length > 0
            ? await getGarden(gardenId)
            : cleanedGarden;
    if (!gardenForOrientationUpdate) {
        return;
    }

    await updateRaisedBedsOrientation(
        gardenForOrientationUpdate,
        new Map(blocks.map((block) => [block.id, block.rotation])),
    );
}
