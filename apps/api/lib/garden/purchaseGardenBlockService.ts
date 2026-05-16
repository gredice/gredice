type PurchaseGardenBlockDependencies = {
    createGardenBlock: (gardenId: number, blockName: string) => Promise<string>;
    createGardenStack: (
        gardenId: number,
        position: { x: number; y: number },
    ) => Promise<unknown>;
    deleteGardenBlock: (gardenId: number, blockId: string) => Promise<unknown>;
    spendSunflowers: (
        accountId: string,
        amount: number,
        source: string,
    ) => Promise<unknown>;
    synchronizeGardenStacksAndRaisedBeds: (
        gardenId: number,
    ) => Promise<unknown>;
    updateGardenStack: (
        gardenId: number,
        stack: { x: number; y: number; blocks: string[] },
    ) => Promise<unknown>;
};

type PurchasedBlockPlacement = {
    existingBlocks: string[];
    x: number;
    y: number;
};

type PurchaseGardenBlockParams = {
    accountId: string;
    blockName: string;
    cost: number;
    gardenId: number;
    hasTargetStack: boolean;
    placement: PurchasedBlockPlacement;
    dependencies: PurchaseGardenBlockDependencies;
};

type PurchaseGardenBlockResult =
    | {
          ok: true;
          blockId: string;
          position: { x: number; y: number };
      }
    | {
          ok: false;
          error: string;
          status: 400 | 500;
      };

export async function purchaseGardenBlock(
    params: PurchaseGardenBlockParams,
): Promise<PurchaseGardenBlockResult> {
    const {
        accountId,
        blockName,
        cost,
        gardenId,
        hasTargetStack,
        placement,
        dependencies,
    } = params;
    const { x, y, existingBlocks } = placement;

    if (!hasTargetStack) {
        await dependencies.createGardenStack(gardenId, { x, y });
    }

    let blockId: string | undefined;
    let didUpdateStack = false;
    try {
        blockId = await dependencies.createGardenBlock(gardenId, blockName);
        await dependencies.updateGardenStack(gardenId, {
            x,
            y,
            blocks: [...existingBlocks, blockId],
        });
        didUpdateStack = true;
        await dependencies.spendSunflowers(
            accountId,
            cost,
            `block:${blockName}`,
        );
    } catch (error) {
        const rollbackOperations: Promise<unknown>[] = [];
        if (didUpdateStack) {
            rollbackOperations.push(
                dependencies.updateGardenStack(gardenId, {
                    x,
                    y,
                    blocks: existingBlocks,
                }),
            );
        }
        if (blockId) {
            rollbackOperations.push(
                dependencies.deleteGardenBlock(gardenId, blockId),
            );
        }
        if (rollbackOperations.length > 0) {
            await Promise.allSettled(rollbackOperations);
        }

        console.error('Failed to place purchased block', {
            gardenId,
            accountId,
            blockName,
            position: { x, y },
            error,
        });

        const errorMessage =
            error instanceof Error ? error.message : 'Failed to place block';
        return {
            ok: false,
            error: errorMessage,
            status: errorMessage === 'Insufficient sunflowers' ? 400 : 500,
        };
    }

    if (!blockId) {
        return {
            ok: false,
            error: 'Failed to place block',
            status: 500,
        };
    }

    if (blockName === 'Raised_Bed') {
        try {
            await dependencies.synchronizeGardenStacksAndRaisedBeds(gardenId);
        } catch (error) {
            console.error(
                'Failed to synchronize raised beds after block purchase',
                {
                    gardenId,
                    accountId,
                    blockId,
                    blockName,
                    error,
                },
            );
        }
    }

    return {
        ok: true,
        blockId,
        position: { x, y },
    };
}
