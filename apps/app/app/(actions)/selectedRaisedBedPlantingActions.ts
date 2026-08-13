'use server';

import {
    assignSelectedRaisedBedPlantingTask,
    blockSelectedRaisedBedPlantingTask,
    cancelSelectedRaisedBedPlantingTask,
    getRaisedBed,
    getRaisedBedPlanting,
    type RaisedBedFieldSowingLocation,
    type RaisedBedPlantingLifecycleStatus,
    rescheduleSelectedRaisedBedPlantingTask,
    type ScheduleTaskBlockReasonCode,
    type SelectedRaisedBedPlantingTaskCommandIdentity,
    updateSelectedRaisedBedPlantingLifecycleStatus,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';
import {
    completeSelectedRaisedBedPlantingTaskAndNotify,
    verifySelectedRaisedBedPlantingTaskAndNotify,
} from './selectedRaisedBedPlantingActionNotifications';

async function getAdminActor() {
    const { userId } = await auth(['admin']);
    return { role: 'admin' as const, userId };
}

async function revalidateSelectedPlantingPaths(plantingId: number) {
    const planting = await getRaisedBedPlanting(plantingId);
    if (!planting) {
        revalidatePath(KnownPages.Schedule);
        return;
    }
    const raisedBed = await getRaisedBed(planting.raisedBedId);
    revalidatePath(KnownPages.Schedule);
    revalidatePath(KnownPages.RaisedBed(planting.raisedBedId));
    if (raisedBed?.accountId) {
        revalidatePath(KnownPages.Account(raisedBed.accountId));
    }
    if (raisedBed?.gardenId) {
        revalidatePath(KnownPages.Garden(raisedBed.gardenId));
    }
}

export async function assignSelectedPlantingTaskAction(
    identity: SelectedRaisedBedPlantingTaskCommandIdentity,
    assignedUserIds: string[],
    commandId: string,
) {
    const result = await assignSelectedRaisedBedPlantingTask({
        ...identity,
        actor: await getAdminActor(),
        assignedUserIds,
        commandId,
    });
    await revalidateSelectedPlantingPaths(identity.plantingId);
    return { result, success: true as const };
}

export async function rescheduleSelectedPlantingTaskAction(
    identity: SelectedRaisedBedPlantingTaskCommandIdentity,
    scheduledDate: string | null,
    sowingLocation: RaisedBedFieldSowingLocation,
    commandId: string,
) {
    const result = await rescheduleSelectedRaisedBedPlantingTask({
        ...identity,
        actor: await getAdminActor(),
        commandId,
        scheduledDate,
        sowingLocation,
    });
    await revalidateSelectedPlantingPaths(identity.plantingId);
    return { result, success: true as const };
}

export async function cancelSelectedPlantingTaskAction(
    identity: SelectedRaisedBedPlantingTaskCommandIdentity,
    reason: string,
    commandId: string,
    effectiveAt?: string,
) {
    const result = await cancelSelectedRaisedBedPlantingTask({
        ...identity,
        actor: await getAdminActor(),
        commandId,
        effectiveAt,
        reason,
    });
    await revalidateSelectedPlantingPaths(identity.plantingId);
    return { result, success: true as const };
}

export async function completeSelectedPlantingTaskAction(
    identity: SelectedRaisedBedPlantingTaskCommandIdentity,
    commandId: string,
) {
    const result = await completeSelectedRaisedBedPlantingTaskAndNotify({
        ...identity,
        actor: await getAdminActor(),
        commandId,
    });
    await revalidateSelectedPlantingPaths(identity.plantingId);
    return { result, success: true as const };
}

export async function blockSelectedPlantingTaskAction(
    identity: SelectedRaisedBedPlantingTaskCommandIdentity,
    reasonCode: ScheduleTaskBlockReasonCode,
    commandId: string,
    note?: string,
) {
    const result = await blockSelectedRaisedBedPlantingTask({
        ...identity,
        actor: await getAdminActor(),
        commandId,
        note,
        reasonCode,
    });
    await revalidateSelectedPlantingPaths(identity.plantingId);
    return { result, success: true as const };
}

export async function verifySelectedPlantingTaskAction(
    identity: SelectedRaisedBedPlantingTaskCommandIdentity,
    commandId: string,
) {
    const result = await verifySelectedRaisedBedPlantingTaskAndNotify({
        ...identity,
        actor: await getAdminActor(),
        commandId,
    });
    await revalidateSelectedPlantingPaths(identity.plantingId);
    return { result, success: true as const };
}

export async function updateSelectedPlantingLifecycleStatusAction(
    identity: SelectedRaisedBedPlantingTaskCommandIdentity,
    status: Exclude<
        RaisedBedPlantingLifecycleStatus,
        'cancelled' | 'pendingVerification'
    >,
    commandId: string,
    effectiveAt?: string,
) {
    const result = await updateSelectedRaisedBedPlantingLifecycleStatus({
        ...identity,
        actor: await getAdminActor(),
        commandId,
        effectiveAt,
        status,
    });
    await revalidateSelectedPlantingPaths(identity.plantingId);
    return { result, success: true as const };
}
