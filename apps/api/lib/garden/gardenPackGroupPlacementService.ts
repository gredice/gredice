import { isDeepStrictEqual } from 'node:util';
import type { BlockData } from '@gredice/directory-types';
import {
    getGardenBlockSpan,
    resolveGardenBlockPlacement,
} from '@gredice/js/gardenBlocks';
import { resolveGardenPackLineVariant } from '@gredice/js/gardenPackAppearanceVariant';
import {
    type GardenPackLayout,
    getGardenPackLayoutCells,
    resolveGardenPackLayoutPlacements,
} from '@gredice/js/gardenPackLayouts';
import {
    AccountDeletionInProgressError,
    AccountNotFoundError,
    assertGardenPackGroupOperationIdsAvailable,
    GardenPackConflictError,
    GardenPackNotFoundError,
    type GardenPackTransaction,
    gardenPackGroupMemberOperationId,
    getGardenPackGroupPlacementReplay,
    getPurchasedGardenPack,
    recordGardenPackPlacement,
    updateGardenBlock,
} from '@gredice/storage';
import {
    type GardenPackGroupPlacementCommand,
    type GardenPackGroupPlacementResponse,
    gardenPackGroupPlacementCommandSchema,
    gardenPackGroupPlacementResponseSchema,
} from '@gredice/storage/gardenPackGroupPlacementContract';
import { settleGardenEconomicMutationDependency } from './gardenEconomicMutationDependency';
import { isGardenPackModelEligible } from './gardenPackEligibility';
import { getOwnedGardenPackLayouts } from './gardenPackLayouts';
import type { GardenPackPlacementDependencies } from './gardenPackPlacementService';
import { placeGardenPackUnitDependencies } from './gardenPackPlacementService';

type Pack = NonNullable<Awaited<ReturnType<typeof getPurchasedGardenPack>>>;
export type GardenPackGroupPlacementDependencies<T> = Omit<
    GardenPackPlacementDependencies<T>,
    'getReplay' | 'recordPlacement'
> & {
    getPack: (
        accountId: string,
        purchaseId: string,
        tx?: T,
    ) => Promise<Pack | undefined>;
    getReplay: (
        command: GardenPackGroupPlacementCommand,
        tx?: T,
    ) => Promise<GardenPackGroupPlacementResponse | null>;
    assertOperationIds: (
        command: GardenPackGroupPlacementCommand,
        ids: string[],
        tx: T,
    ) => Promise<void>;
    updateRotation: (
        gardenId: number,
        blockId: string,
        rotation: number,
        tx: T,
    ) => Promise<unknown>;
    recordGroup: (
        command: GardenPackGroupPlacementCommand,
        response: GardenPackGroupPlacementResponse,
        layout: GardenPackLayout,
        tx: T,
    ) => Promise<void>;
};
class GroupError extends Error {
    constructor(
        readonly code: string,
        readonly status: 400 | 404 | 409 | 503,
        message: string,
    ) {
        super(message);
    }
}

function resolveLayoutGeometry(
    layout: GardenPackLayout,
    command: Pick<GardenPackGroupPlacementCommand, 'anchor' | 'rotation'>,
) {
    try {
        const placements = resolveGardenPackLayoutPlacements(
            layout,
            command.anchor,
            command.rotation,
        );
        return { placements, cells: getGardenPackLayoutCells(placements) };
    } catch {
        throw new GroupError(
            'INVALID_LAYOUT_GEOMETRY',
            400,
            'Raspored prelazi podržane granice vrta.',
        );
    }
}
export type GardenPackGroupPlacementResult =
    | ({ ok: true; replayed: boolean } & GardenPackGroupPlacementResponse)
    | { ok: false; status: 400 | 404 | 409 | 503; code: string; error: string };
export function assertGardenPackLayoutDirectory(
    layout: GardenPackLayout,
    blocks: readonly BlockData[],
) {
    for (const slot of layout.placements) {
        const byId = blocks.filter(
            (block) => block.id.toString() === slot.entityId,
        );
        const byName = blocks.filter(
            (block) => block.information.name === slot.modelName,
        );
        const block = byId[0];
        if (
            !block ||
            byId.length !== 1 ||
            byName.length !== 1 ||
            byName[0] !== block ||
            block.entityType.name !== 'block' ||
            !isGardenPackModelEligible(slot.modelName) ||
            block.attributes.type !== 'decoration' ||
            block.functions.raisedBed !== false ||
            block.functions.recycler !== false ||
            !isDeepStrictEqual(getGardenBlockSpan(block), slot.footprint)
        )
            throw new GroupError(
                'LAYOUT_UNAVAILABLE',
                409,
                'Raspored trenutačno nije dostupan.',
            );
        resolveGardenPackLineVariant(slot);
    }
}
export function createGardenPackGroupPlacementService<T>(
    dependencies: GardenPackGroupPlacementDependencies<T>,
) {
    return async (
        input: GardenPackGroupPlacementCommand,
    ): Promise<GardenPackGroupPlacementResult> => {
        const parsed = gardenPackGroupPlacementCommandSchema.safeParse(input);
        if (!parsed.success)
            return {
                ok: false,
                status: 400,
                code: 'INVALID_REQUEST',
                error: 'Neispravan zahtjev za raspored.',
            };
        const command = parsed.data;
        if (command.accountId !== command.expectedAccountId)
            return {
                ok: false,
                status: 409,
                code: 'EXPECTED_ACCOUNT_MISMATCH',
                error: 'Račun se promijenio. Vrati se na račun za ovaj raspored.',
            };
        try {
            const preliminary = await dependencies.getReplay(command);
            const directory = preliminary
                ? null
                : await settleGardenEconomicMutationDependency(
                      dependencies.getBlockData,
                  );
            return await dependencies.withAccountTransaction(
                command.accountId,
                async (tx) => {
                    const replay = await dependencies.getReplay(command, tx);
                    if (replay) return { ok: true, ...replay, replayed: true };
                    const pack = await dependencies.getPack(
                        command.accountId,
                        command.purchaseId,
                        tx,
                    );
                    if (!pack)
                        throw new GardenPackNotFoundError(
                            'Purchased pack not found',
                        );
                    const layout = getOwnedGardenPackLayouts(pack).find(
                        (layout) => layout.id === command.layoutId,
                    );
                    if (!layout || layout.versionId !== command.layoutVersionId)
                        throw new GroupError(
                            'LAYOUT_VERSION_CHANGED',
                            409,
                            'Raspored se promijenio. Osvježi paket.',
                        );
                    if (
                        command.units.length !== layout.placements.length ||
                        new Set(command.units.map((u) => u.slotId)).size !==
                            command.units.length ||
                        new Set(
                            command.units.map(
                                (u) => `${u.lineId}:${u.unitOrdinal}`,
                            ),
                        ).size !== command.units.length
                    )
                        throw new GroupError(
                            'UNITS_CHANGED',
                            409,
                            'Predmeti za raspored su se promijenili.',
                        );
                    const members = layout.placements.map((slot) => {
                        const unit = command.units.find(
                            (unit) => unit.slotId === slot.slotId,
                        );
                        if (!unit || unit.lineId !== slot.lineId)
                            throw new GroupError(
                                'UNITS_CHANGED',
                                409,
                                'Predmeti za raspored su se promijenili.',
                            );
                        return { slot, unit };
                    });
                    await dependencies.assertOperationIds(
                        command,
                        members.map((_, i) =>
                            gardenPackGroupMemberOperationId(command, i),
                        ),
                        tx,
                    );
                    // Stable unit-lock order precedes the garden lock, matching lifecycle/delete flows.
                    for (const { slot, unit } of [...members].sort(
                        (a, b) =>
                            a.unit.lineId.localeCompare(b.unit.lineId) ||
                            a.unit.unitOrdinal - b.unit.unitOrdinal,
                    )) {
                        await dependencies.getUnit(
                            {
                                accountId: command.accountId,
                                purchaseId: command.purchaseId,
                                gardenId: command.gardenId,
                                lineId: unit.lineId,
                                unitOrdinal: unit.unitOrdinal,
                                operationId: command.operationId,
                                position: command.anchor,
                                expectedExistingBlocks: [],
                                variant: slot.variant,
                            },
                            tx,
                        );
                    }
                    if (!directory || directory.status === 'rejected')
                        throw new GroupError(
                            'BLOCK_DIRECTORY_UNAVAILABLE',
                            503,
                            'Podaci o predmetima trenutačno nisu dostupni.',
                        );
                    assertGardenPackLayoutDirectory(layout, directory.value);
                    const { placements, cells } = resolveLayoutGeometry(
                        layout,
                        command,
                    );
                    if (
                        cells.length !==
                        placements.reduce(
                            (sum, p) =>
                                sum + p.footprint.width * p.footprint.depth,
                            0,
                        )
                    )
                        throw new GroupError(
                            'LAYOUT_OVERLAP',
                            409,
                            'Raspored sadrži preklapanje predmeta.',
                        );
                    if (
                        cells.length !== command.expectedStacks.length ||
                        new Set(
                            command.expectedStacks.map(
                                (s) => `${s.positionX}|${s.positionY}`,
                            ),
                        ).size !== cells.length
                    )
                        throw new GroupError(
                            'INVALID_EXPECTED_STACKS',
                            400,
                            'Potrebna su sva mjesta rasporeda.',
                        );
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
                                throw new GroupError(
                                    'GARDEN_NOT_FOUND',
                                    404,
                                    'Odaberi vlastiti aktivni vrt.',
                                );
                            for (const cell of cells) {
                                const expected = command.expectedStacks.find(
                                    (s) =>
                                        s.positionX === cell.positionX &&
                                        s.positionY === cell.positionY,
                                );
                                const actual =
                                    snapshot.stacks.find(
                                        (s) =>
                                            s.positionX === cell.positionX &&
                                            s.positionY === cell.positionY,
                                    )?.blocks ?? [];
                                if (
                                    !expected ||
                                    !isDeepStrictEqual(actual, expected.blocks)
                                )
                                    throw new GroupError(
                                        'GARDEN_STATE_CHANGED',
                                        409,
                                        'Vrt se promijenio. Provjeri raspored.',
                                    );
                            }
                            const stacks = snapshot.stacks.map((s) => ({
                                positionX: s.positionX,
                                positionY: s.positionY,
                                blocks: [...s.blocks],
                            }));
                            const names = new Map(
                                snapshot.blocks.map((b) => [b.id, b.name]),
                            );
                            const rotations = new Map(
                                snapshot.blocks.map((b) => [b.id, b.rotation]),
                            );
                            const data = new Map(
                                directory.value.map((b) => [
                                    b.information.name,
                                    b,
                                ]),
                            );
                            const validated = placements.map((placement, i) => {
                                const result = resolveGardenBlockPlacement({
                                    blockName: placement.modelName,
                                    requestedPosition: placement.position,
                                    requestedRotation: placement.rotation,
                                    stacks,
                                    blockNameById: names,
                                    blockRotationById: rotations,
                                    blockDataByName: data,
                                });
                                if (!result.valid)
                                    throw new GroupError(
                                        'GROUP_PLACEMENT_INVALID',
                                        409,
                                        'Cijeli raspored nije moguće postaviti na odabrana mjesta.',
                                    );
                                const ghostId = `group-candidate:${i}`;
                                names.set(ghostId, placement.modelName);
                                rotations.set(ghostId, placement.rotation);
                                const existing = stacks.find(
                                    (s) =>
                                        s.positionX === placement.position.x &&
                                        s.positionY === placement.position.y,
                                );
                                if (existing) existing.blocks.push(ghostId);
                                else
                                    stacks.push({
                                        positionX: placement.position.x,
                                        positionY: placement.position.y,
                                        blocks: [ghostId],
                                    });
                                return {
                                    ...placement,
                                    existingBlocks:
                                        result.placement.existingBlocks,
                                };
                            });
                            // All validation finished; every physical write and unit receipt shares this transaction.
                            const responsePlacements = [];
                            for (const placement of validated) {
                                const unit = command.units.find(
                                    (u) => u.slotId === placement.slotId,
                                );
                                if (!unit)
                                    throw new Error('Validated unit missing');
                                const { x, y } = placement.position;
                                if (
                                    !snapshot.stacks.some(
                                        (s) =>
                                            s.positionX === x &&
                                            s.positionY === y,
                                    )
                                )
                                    await dependencies.createStack(
                                        command.gardenId,
                                        { x, y },
                                        gardenTx,
                                    );
                                const variant =
                                    resolveGardenPackLineVariant(placement);
                                const blockId = await dependencies.createBlock(
                                    command.gardenId,
                                    placement.modelName,
                                    variant,
                                    gardenTx,
                                );
                                await dependencies.updateRotation(
                                    command.gardenId,
                                    blockId,
                                    placement.rotation,
                                    gardenTx,
                                );
                                await dependencies.updateStack(
                                    command.gardenId,
                                    {
                                        x,
                                        y,
                                        blocks: [
                                            ...placement.existingBlocks,
                                            blockId,
                                        ],
                                    },
                                    gardenTx,
                                );
                                responsePlacements.push({
                                    slotId: placement.slotId,
                                    lineId: unit.lineId,
                                    unitOrdinal: unit.unitOrdinal,
                                    modelName: placement.modelName,
                                    blockId,
                                    variant,
                                    rotation: placement.rotation,
                                    position: { x, y },
                                    existingBlocks: placement.existingBlocks,
                                });
                            }
                            const response =
                                gardenPackGroupPlacementResponseSchema.parse({
                                    operationId: command.operationId,
                                    purchaseId: command.purchaseId,
                                    gardenId: command.gardenId,
                                    layoutId: command.layoutId,
                                    layoutVersionId: command.layoutVersionId,
                                    chargedSunflowers: 0,
                                    placements: responsePlacements,
                                });
                            await dependencies.recordGroup(
                                command,
                                response,
                                layout,
                                gardenTx,
                            );
                            return { ok: true, ...response, replayed: false };
                        },
                        tx,
                    );
                },
            );
        } catch (error) {
            if (error instanceof GroupError)
                return {
                    ok: false,
                    status: error.status,
                    code: error.code,
                    error: error.message,
                };
            if (error instanceof GardenPackConflictError)
                return {
                    ok: false,
                    status: 409,
                    code: 'OPERATION_CONFLICT',
                    error: 'Predmet ili zahtjev promijenio se. Osvježi paket.',
                };
            if (
                error instanceof GardenPackNotFoundError ||
                error instanceof AccountNotFoundError
            )
                return {
                    ok: false,
                    status: 404,
                    code: 'PACK_NOT_FOUND',
                    error: 'Kupljeni paket nije pronađen.',
                };
            if (error instanceof AccountDeletionInProgressError)
                return {
                    ok: false,
                    status: 409,
                    code: 'ACCOUNT_UNAVAILABLE',
                    error: 'Račun se trenutačno briše.',
                };
            throw error;
        }
    };
}
export const gardenPackGroupPlacementDependencies: GardenPackGroupPlacementDependencies<GardenPackTransaction> =
    {
        ...placeGardenPackUnitDependencies,
        getPack: getPurchasedGardenPack,
        getReplay: getGardenPackGroupPlacementReplay,
        assertOperationIds: assertGardenPackGroupOperationIdsAvailable,
        updateRotation: (gardenId, blockId, rotation, tx) =>
            updateGardenBlock(gardenId, { id: blockId, rotation }, tx),
        recordGroup: async (command, response, layout, tx) => {
            for (const [i, placement] of response.placements.entries()) {
                const slot = layout.placements.find(
                    (s) => s.slotId === placement.slotId,
                );
                if (!slot) throw new Error('Validated layout slot missing');
                await recordGardenPackPlacement(
                    {
                        accountId: command.accountId,
                        purchaseId: command.purchaseId,
                        gardenId: command.gardenId,
                        operationId: gardenPackGroupMemberOperationId(
                            command,
                            i,
                        ),
                        lineId: placement.lineId,
                        unitOrdinal: placement.unitOrdinal,
                        position: placement.position,
                        expectedExistingBlocks: placement.existingBlocks,
                        variant: slot.variant,
                    },
                    {
                        blockId: placement.blockId,
                        position: placement.position,
                        variant: placement.variant,
                    },
                    tx,
                    { command, response, root: i === 0 },
                );
            }
        },
    };
export const placeGardenPackGroupForAccount =
    createGardenPackGroupPlacementService(gardenPackGroupPlacementDependencies);
