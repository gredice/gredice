import type { BlockData } from '@gredice/directory-types';
import { resolveGardenBlockPlacement } from '@gredice/js/gardenBlocks';
import { resolveGardenPackLineVariant } from '@gredice/js/gardenPackAppearanceVariant';
import {
    AccountDeletionInProgressError,
    AccountNotFoundError,
    createGardenBlock,
    createGardenStack,
    GardenPackConflictError,
    GardenPackNotFoundError,
    type GardenPackTransaction,
    type GardenPlacementSnapshot,
    getGardenPackPlacementReplay,
    getGardenPackPlacementUnitForUpdate,
    getGardenPlacementSnapshotForUpdate,
    recordGardenPackPlacement,
    updateGardenStack,
    withAccountDeletionFenceTransaction,
    withGardenPlacementTransaction,
    withSunflowerAccountTransaction,
} from '@gredice/storage';
import {
    type GardenPackPlacementCommand,
    type GardenPackPlacementResponse,
    gardenPackPlacementCommandSchema,
} from '@gredice/storage/gardenPackPlacementContract';
import { getBlockData } from '../blocks/blockDataService';
import { settleGardenEconomicMutationDependency } from './gardenEconomicMutationDependency';
import { isGardenPackModelEligible } from './gardenPackEligibility';

type Unit = Awaited<ReturnType<typeof getGardenPackPlacementUnitForUpdate>>;
export type GardenPackPlacementDependencies<Transaction> = {
    withAccountTransaction: <T>(
        accountId: string,
        callback: (tx: Transaction) => Promise<T>,
    ) => Promise<T>;
    withGardenTransaction: <T>(
        gardenId: number,
        callback: (tx: Transaction) => Promise<T>,
        tx: Transaction,
    ) => Promise<T>;
    getReplay: (
        command: GardenPackPlacementCommand,
        tx: Transaction,
    ) => Promise<GardenPackPlacementResponse | null>;
    getUnit: (
        command: GardenPackPlacementCommand,
        tx: Transaction,
    ) => Promise<Unit>;
    getSnapshot: (
        gardenId: number,
        tx: Transaction,
    ) => Promise<GardenPlacementSnapshot | null>;
    getBlockData: () => Promise<readonly BlockData[]>;
    createBlock: (
        gardenId: number,
        name: string,
        variant: number | null,
        tx: Transaction,
    ) => Promise<string>;
    createStack: (
        gardenId: number,
        position: { x: number; y: number },
        tx: Transaction,
    ) => Promise<unknown>;
    updateStack: (
        gardenId: number,
        stack: { x: number; y: number; blocks: string[] },
        tx: Transaction,
    ) => Promise<unknown>;
    recordPlacement: (
        command: GardenPackPlacementCommand,
        response: GardenPackPlacementResponse,
        tx: Transaction,
    ) => Promise<void>;
};
export type GardenPackPlacementResult =
    | ({ ok: true; replayed: boolean } & GardenPackPlacementResponse)
    | { ok: false; code: string; error: string; status: 400 | 404 | 409 | 503 };
class PlacementError extends Error {
    constructor(
        readonly code: string,
        readonly status: 400 | 404 | 409 | 503,
        message: string,
    ) {
        super(message);
    }
}
export function createGardenPackPlacementService<Transaction>(
    dependencies: GardenPackPlacementDependencies<Transaction>,
) {
    return async (
        input: GardenPackPlacementCommand,
    ): Promise<GardenPackPlacementResult> => {
        const parsed = gardenPackPlacementCommandSchema.safeParse(input);
        if (!parsed.success)
            return {
                ok: false,
                code: 'INVALID_REQUEST',
                error: 'Neispravan zahtjev za postavljanje predmeta iz paketa.',
                status: 400,
            };
        const command = parsed.data;
        try {
            return await dependencies.withAccountTransaction(
                command.accountId,
                async (tx) => {
                    // Account-scoped durable receipt comes first: exact replay needs no directory or active garden.
                    const replay = await dependencies.getReplay(command, tx);
                    if (replay) return { ok: true, ...replay, replayed: true };
                    const unit = await dependencies.getUnit(command, tx);
                    const directory =
                        await settleGardenEconomicMutationDependency(
                            dependencies.getBlockData,
                        );
                    if (directory.status === 'rejected')
                        throw new PlacementError(
                            'BLOCK_DIRECTORY_UNAVAILABLE',
                            503,
                            'Podaci o predmetima trenutačno nisu dostupni.',
                        );
                    const blockData = directory.value;
                    const matches = blockData.filter(
                        (block) =>
                            block.id.toString() === unit.entityId &&
                            block.information.name === unit.modelName,
                    );
                    if (
                        matches.length !== 1 ||
                        !isGardenPackModelEligible(unit.modelName)
                    )
                        throw new PlacementError(
                            'BLOCK_NOT_ELIGIBLE',
                            409,
                            'Kupljeni predmet trenutačno nije dostupan za postavljanje.',
                        );
                    const requestedBlock = matches[0];
                    if (
                        requestedBlock?.attributes.type !== 'decoration' ||
                        requestedBlock.functions.raisedBed ||
                        requestedBlock.functions.recycler
                    )
                        throw new PlacementError(
                            'BLOCK_NOT_ELIGIBLE',
                            409,
                            'Kupljeni predmet trenutačno nije dostupan za postavljanje.',
                        );
                    let variant: number | null;
                    try {
                        variant = resolveGardenPackLineVariant(unit);
                    } catch {
                        throw new PlacementError(
                            'FIXED_VARIANT_UNAVAILABLE',
                            409,
                            'Odabrani izgled predmeta trenutačno nije dostupan.',
                        );
                    }
                    return dependencies.withGardenTransaction(
                        command.gardenId,
                        async (gardenTx) => {
                            const snapshot = await dependencies.getSnapshot(
                                command.gardenId,
                                gardenTx,
                            );
                            if (
                                !snapshot ||
                                snapshot.garden.accountId !==
                                    command.accountId ||
                                snapshot.garden.isSandbox
                            )
                                throw new PlacementError(
                                    'GARDEN_NOT_FOUND',
                                    404,
                                    'Odaberi vlastiti aktivni vrt.',
                                );
                            const placement = resolveGardenBlockPlacement({
                                blockName: unit.modelName,
                                stacks: snapshot.stacks.map((stack) => ({
                                    ...stack,
                                    blocks: [...stack.blocks],
                                })),
                                blockNameById: new Map(
                                    snapshot.blocks.map((block) => [
                                        block.id,
                                        block.name,
                                    ]),
                                ),
                                blockRotationById: new Map(
                                    snapshot.blocks.map((block) => [
                                        block.id,
                                        block.rotation,
                                    ]),
                                ),
                                blockDataByName: new Map(
                                    blockData.map((block) => [
                                        block.information.name,
                                        block,
                                    ]),
                                ),
                                requestedPosition: command.position,
                            });
                            if (!placement.valid)
                                throw new PlacementError(
                                    'BLOCK_PLACEMENT_INVALID',
                                    400,
                                    placement.error,
                                );
                            const { x, y, existingBlocks } =
                                placement.placement;
                            if (
                                existingBlocks.length !==
                                    command.expectedExistingBlocks.length ||
                                existingBlocks.some(
                                    (id, index) =>
                                        id !==
                                        command.expectedExistingBlocks[index],
                                )
                            )
                                throw new PlacementError(
                                    'GARDEN_STATE_CHANGED',
                                    409,
                                    'Mjesto za postavljanje promijenilo se. Pokušaj ponovno.',
                                );
                            if (
                                !snapshot.stacks.some(
                                    (stack) =>
                                        stack.positionX === x &&
                                        stack.positionY === y,
                                )
                            )
                                await dependencies.createStack(
                                    command.gardenId,
                                    { x, y },
                                    gardenTx,
                                );
                            const blockId = await dependencies.createBlock(
                                command.gardenId,
                                unit.modelName,
                                variant,
                                gardenTx,
                            );
                            await dependencies.updateStack(
                                command.gardenId,
                                { x, y, blocks: [...existingBlocks, blockId] },
                                gardenTx,
                            );
                            const response = {
                                blockId,
                                variant,
                                position: { x, y },
                            };
                            await dependencies.recordPlacement(
                                command,
                                response,
                                gardenTx,
                            );
                            return { ok: true, ...response, replayed: false };
                        },
                        tx,
                    );
                },
            );
        } catch (error) {
            if (error instanceof PlacementError)
                return {
                    ok: false,
                    code: error.code,
                    error: error.message,
                    status: error.status,
                };
            if (error instanceof GardenPackConflictError)
                return {
                    ok: false,
                    code: 'OPERATION_CONFLICT',
                    error: 'Predmet ili zahtjev za postavljanje promijenio se. Osvježi paket.',
                    status: 409,
                };
            if (
                error instanceof GardenPackNotFoundError ||
                error instanceof AccountNotFoundError
            )
                return {
                    ok: false,
                    code: 'PACK_NOT_FOUND',
                    error: 'Kupljeni paket nije pronađen.',
                    status: 404,
                };
            if (error instanceof AccountDeletionInProgressError)
                return {
                    ok: false,
                    code: 'ACCOUNT_UNAVAILABLE',
                    error: 'Račun se trenutačno briše.',
                    status: 409,
                };
            throw error;
        }
    };
}
export const placeGardenPackUnitForAccount =
    createGardenPackPlacementService<GardenPackTransaction>({
        withAccountTransaction: (accountId, callback) =>
            withSunflowerAccountTransaction(accountId, (tx) =>
                withAccountDeletionFenceTransaction(accountId, callback, tx),
            ),
        withGardenTransaction: withGardenPlacementTransaction,
        getReplay: getGardenPackPlacementReplay,
        getUnit: getGardenPackPlacementUnitForUpdate,
        getSnapshot: getGardenPlacementSnapshotForUpdate,
        getBlockData,
        createBlock: createGardenBlock,
        createStack: createGardenStack,
        updateStack: updateGardenStack,
        recordPlacement: recordGardenPackPlacement,
    });
