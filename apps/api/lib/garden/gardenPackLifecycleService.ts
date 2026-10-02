import { resolveGardenBlockPlacement } from '@gredice/js/gardenBlocks';
import { resolveGardenPackLineVariant } from '@gredice/js/gardenPackAppearanceVariant';
import {
    createGardenStack,
    getGardenPlacementSnapshotForUpdate,
    updateGardenStack,
    withStoredGardenPackUnit,
} from '@gredice/storage';
import { gardenPackPlacementResponseSchema } from '@gredice/storage/gardenPackPlacementContract';
import { getBlockData } from '../blocks/blockDataService';
import { settleGardenEconomicMutationDependency } from './gardenEconomicMutationDependency';

export async function retrieveStoredGardenPackUnit(
    accountId: string,
    input: {
        purchaseId: string;
        lineId: string;
        unitOrdinal: number;
        operationId: string;
        gardenId: number;
        gardenBoxBlockId: string;
    },
) {
    // Directory preparation cannot borrow the shared pool while a wallet/box transaction holds its connection.
    const directory =
        await settleGardenEconomicMutationDependency(getBlockData);
    const { operationId: _operationId, ...payload } = input;
    return withStoredGardenPackUnit(
        accountId,
        input,
        payload,
        async (unit, blockId, tx) => {
            if (directory.status === 'rejected')
                throw new Error(
                    'Podaci o predmetima trenutačno nisu dostupni.',
                );
            const blockData = directory.value;
            const block = blockData.find(
                (candidate) =>
                    candidate.id.toString() === unit.entityId &&
                    candidate.information.name === unit.modelName,
            );
            if (block?.entityType.name !== 'block')
                throw new Error(
                    'Kupljeni predmet trenutačno nije dostupan za postavljanje.',
                );
            const snapshot = await getGardenPlacementSnapshotForUpdate(
                input.gardenId,
                tx,
            );
            if (
                !snapshot ||
                snapshot.garden.accountId !== accountId ||
                snapshot.garden.isSandbox ||
                !snapshot.blocks.some(
                    (b) =>
                        b.id === input.gardenBoxBlockId &&
                        b.name === 'GardenBox',
                ) ||
                !snapshot.stacks.some((s) =>
                    s.blocks.includes(input.gardenBoxBlockId),
                )
            )
                throw new Error('Odaberi vlastitu vrtnu kutiju.');
            const placement = resolveGardenBlockPlacement({
                blockName: unit.modelName,
                stacks: snapshot.stacks.map((stack) => ({
                    ...stack,
                    blocks: [...stack.blocks],
                })),
                blockNameById: new Map(
                    snapshot.blocks.map((b) => [b.id, b.name]),
                ),
                blockRotationById: new Map(
                    snapshot.blocks.map((b) => [b.id, b.rotation]),
                ),
                blockDataByName: new Map(
                    blockData.map((b) => [b.information.name, b]),
                ),
            });
            if (!placement.valid) throw new Error(placement.error);
            const { x, y, existingBlocks } = placement.placement;
            if (
                !snapshot.stacks.some(
                    (stack) => stack.positionX === x && stack.positionY === y,
                )
            )
                await createGardenStack(input.gardenId, { x, y }, tx);
            await updateGardenStack(
                input.gardenId,
                { x, y, blocks: [...existingBlocks, blockId] },
                tx,
            );
            return {
                blockId,
                variant: resolveGardenPackLineVariant(unit),
                position: { x, y },
            };
        },
        (response) => gardenPackPlacementResponseSchema.parse(response),
    );
}
