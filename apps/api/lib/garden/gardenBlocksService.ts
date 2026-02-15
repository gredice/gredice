import {
    deleteRaisedBed,
    earnSunflowers,
    getGarden,
    getGardenBlock,
    getGardenStacks,
    getRaisedBeds,
    deleteGardenBlock as storageDeleteGardenBlock,
    updateGardenStack,
} from '@gredice/storage';
import { getBlockData } from '../blocks/blockDataService';

const DEFAULT_RECYCLE_REFUND = 10;

export async function deleteGardenBlock(
    accountId: string,
    gardenId: number,
    blockId: string,
) {
    const [garden, stacks, block, blocksData] = await Promise.all([
        getGarden(gardenId),
        getGardenStacks(gardenId),
        getGardenBlock(gardenId, blockId),
        getBlockData(),
    ]);

    // Check garden exists and is owned by user
    if (!garden || garden.accountId !== accountId) {
        console.warn('Garden not found or not owned by user', {
            accountId,
            gardenId,
        });
        return {
            errorMessage: 'Garden not found',
            errorStatus: 404,
        };
    }
    if (!block || block.gardenId !== gardenId) {
        console.warn('Block not found or not assigned to requested garden', {
            gardenId,
            blockId,
        });
        return {
            errorMessage: 'Block not found',
            errorStatus: 404,
        };
    }

    // Retrieve block data
    const blockData = blocksData.find(
        (bd) => bd.information?.name === block.name,
    );
    if (!blockData) {
        console.warn('Block data not found', { blockId });
        return {
            errorMessage: 'Requested block data not found',
            errorStatus: 404,
        };
    }

    let relatedRaisedBed:
        | Awaited<ReturnType<typeof getRaisedBeds>>[number]
        | undefined;

    // Don't allow deletion of active raised beds
    if (blockData.functions?.raisedBed) {
        const raisedBeds = await getRaisedBeds(gardenId);
        relatedRaisedBed = raisedBeds.find((candidateRaisedBed) => {
            if (!candidateRaisedBed.blockId) {
                return false;
            }

            if (candidateRaisedBed.blockId === blockId) {
                return true;
            }

            const primaryStack = stacks.find((candidateStack) =>
                candidateStack.blocks.includes(
                    candidateRaisedBed.blockId ?? '',
                ),
            );
            if (!primaryStack) {
                return false;
            }

            const primaryIndex = primaryStack.blocks.indexOf(
                candidateRaisedBed.blockId,
            );
            if (primaryIndex < 0) {
                return false;
            }

            const attachedBlockId = stacks
                .map((candidateStack) => ({
                    candidateStack,
                    candidateBlockId: candidateStack.blocks[primaryIndex],
                }))
                .find(({ candidateStack, candidateBlockId }) => {
                    if (
                        !candidateBlockId ||
                        candidateBlockId === candidateRaisedBed.blockId
                    ) {
                        return false;
                    }

                    const sameX =
                        candidateStack.positionX === primaryStack.positionX;
                    const sameY =
                        candidateStack.positionY === primaryStack.positionY;

                    return (
                        (sameX &&
                            Math.abs(
                                candidateStack.positionY -
                                    primaryStack.positionY,
                            ) === 1) ||
                        (sameY &&
                            Math.abs(
                                candidateStack.positionX -
                                    primaryStack.positionX,
                            ) === 1)
                    );
                })?.candidateBlockId;

            return attachedBlockId === blockId;
        });
        if (relatedRaisedBed && relatedRaisedBed.status !== 'new') {
            console.warn('Cannot delete active raised bed', {
                blockId,
                raisedBed: relatedRaisedBed,
            });
            return {
                errorMessage: 'Cannot delete active raised bed',
                errorStatus: 400,
            };
        }
    }

    // Retrieve block price
    const price = blockData.prices?.sunflowers ?? 0;
    const refundAmount = price > 0 ? price : DEFAULT_RECYCLE_REFUND;
    if (price <= 0) {
        console.info('Block has no sunflower price. Using recycle refund.', {
            blockId,
            refundAmount,
        });
    }

    // Prepare stack remove operation
    const stack = stacks.find((stack) => stack.blocks.includes(blockId));
    const stackRemovePromise = stack
        ? await updateGardenStack(gardenId, {
              x: stack.positionX,
              y: stack.positionY,
              blocks: stack.blocks.filter(
                  (blockIdInStack) => blockIdInStack !== blockId,
              ),
          })
        : Promise.resolve();

    // Prepare block refund operation
    const refundBlockPromise = earnSunflowers(
        garden.accountId,
        refundAmount,
        `recycle:${block.name}`,
    );

    await Promise.all([
        storageDeleteGardenBlock(gardenId, blockId),
        ...(relatedRaisedBed ? [deleteRaisedBed(relatedRaisedBed.id)] : []),
        refundBlockPromise,
        stackRemovePromise,
    ]);
}
