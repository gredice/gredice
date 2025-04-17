import { earnSunflowers, getGarden, getGardenBlock, deleteGardenBlock as storageDeleteGardenBlock, getGardenStacks, updateGardenStack } from "@gredice/storage";
import { getBlockData } from "../blocks/blockDataService";

export async function deleteGardenBlock(accountId: string, gardenId: number, blockId: string) {
    const [garden, stacks, block, blocksData] = await Promise.all([
        getGarden(gardenId),
        getGardenStacks(gardenId),
        getGardenBlock(gardenId, blockId),
        getBlockData()
    ]);

    // Check garden exists and is owned by user
    if (!garden || garden.accountId !== accountId) {
        console.warn("Garden not found or not owned by user", { accountId, gardenId });
        return {
            errorMessage: "Garden not found",
            errorStatus: 404
        };
    }
    if (!block || block.gardenId !== gardenId) {
        console.warn("Block not found or not assigned to requested garden", { gardenId, blockId });
        return {
            errorMessage: 'Block not found',
            errorStatus: 404
        };
    }

    // Retrieve block price
    const blockData = blocksData.find(bd => bd.information.name === block.name);
    if (!blockData) {
        console.warn("Block data not found", { blockId });
        return {
            errorMessage: 'Requested block data not found',
            errorStatus: 404
        };
    }
    const price = blockData.prices.sunflowers ?? 0;
    if (price <= 0) {
        console.warn("Block not for sale so we can't refund. Will continue with removal.", { blockId });
    }

    // Prepare stack remove operation
    const stack = stacks.find(stack => stack.blocks.includes(blockId));
    const stackRemovePromise = stack
        ? await updateGardenStack(gardenId, {
            x: stack.positionX,
            y: stack.positionY,
            blocks: stack.blocks.filter(blockIdInStack => blockIdInStack !== blockId)
        })
        : Promise.resolve();

    // Prepare block refund operation
    const refundBlockPromise = price > 0
        ? earnSunflowers(garden.accountId, price, `block:${blockData.information.name}`)
        : Promise.resolve();

    await Promise.all([
        storageDeleteGardenBlock(gardenId, blockId),
        refundBlockPromise,
        stackRemovePromise
    ]);
}