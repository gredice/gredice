import 'server-only';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { and, eq, inArray } from 'drizzle-orm';
import {
    type GardenPackGroupPlacementCommand,
    gardenPackGroupPlacementResponseSchema,
} from '../gardenPackGroupPlacementContract';
import { gardenPackLifecycleReceipts, gardenPackUnitEvents } from '../schema';
import { storage } from '../storage';
import {
    GardenPackConflictError,
    type GardenPackTransaction,
} from './gardenPacksRepo';

/** Internal IDs exceed every public placement/lifecycle operation-ID limit. */
export function gardenPackGroupMemberOperationId(
    command: GardenPackGroupPlacementCommand,
    index: number,
) {
    if (!Number.isInteger(index) || index < 0 || index >= 32)
        throw new Error('Invalid group member');
    if (index === 0) return command.operationId;
    const digest = createHash('sha256')
        .update(`${command.accountId}:${command.operationId}`)
        .digest('hex');
    return `garden-pack-group-member:v1:${digest}:${index.toString().padStart(2, '0')}:internal-only`;
}
export async function getGardenPackGroupPlacementReplay(
    command: GardenPackGroupPlacementCommand,
    tx: GardenPackTransaction | ReturnType<typeof storage> = storage(),
) {
    const [event] = await tx
        .select()
        .from(gardenPackUnitEvents)
        .where(
            and(
                eq(gardenPackUnitEvents.accountId, command.accountId),
                eq(gardenPackUnitEvents.operationId, command.operationId),
            ),
        )
        .limit(1);
    if (event) {
        if (
            event.kind !== 'placed' ||
            !isDeepStrictEqual(event.placementPayload, {
                kind: 'group-placement:v1',
                command,
            })
        )
            throw new GardenPackConflictError(
                'Operation belongs to a different placement',
            );
        const response = event.placementResponse;
        return gardenPackGroupPlacementResponseSchema.parse(response?.group);
    }
    await assertGardenPackGroupOperationIdsAvailable(
        command,
        [command.operationId],
        tx,
    );
    return null;
}
/** Check all IDs before writes. Caller holds the account economic/deletion fence. */
export async function assertGardenPackGroupOperationIdsAvailable(
    command: GardenPackGroupPlacementCommand,
    operationIds: string[],
    tx: GardenPackTransaction | ReturnType<typeof storage>,
) {
    const event = await tx
        .select({ id: gardenPackUnitEvents.id })
        .from(gardenPackUnitEvents)
        .where(
            and(
                eq(gardenPackUnitEvents.accountId, command.accountId),
                inArray(gardenPackUnitEvents.operationId, operationIds),
            ),
        )
        .limit(1);
    const lifecycle = await tx
        .select({ id: gardenPackLifecycleReceipts.id })
        .from(gardenPackLifecycleReceipts)
        .where(
            and(
                eq(gardenPackLifecycleReceipts.accountId, command.accountId),
                inArray(gardenPackLifecycleReceipts.operationId, operationIds),
            ),
        )
        .limit(1);
    if (event.length || lifecycle.length)
        throw new GardenPackConflictError(
            'Group operation identifier is already used',
        );
}
