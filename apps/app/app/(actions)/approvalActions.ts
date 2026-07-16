'use server';

import { getRaisedBedCloseupUrl } from '@gredice/js/urls';
import {
    approvePlantStatusApprovalRequest,
    createNotification,
    getEntityFormatted,
    getRaisedBed,
    rejectApprovalRequest,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import type { EntityStandardized } from '../../lib/@types/EntityStandardized';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';
import { completeOperation } from './operationActions';
import { verifyRaisedBedPlantingAction } from './raisedBedFieldsActions';

function revalidateApprovalQueues() {
    revalidatePath(KnownPages.Approvals);
    revalidatePath(KnownPages.Schedule);
}

function revalidateApprovedPlantStatusPaths(
    request: Awaited<ReturnType<typeof approvePlantStatusApprovalRequest>>,
) {
    const target = request.target;
    revalidatePath(KnownPages.Greenhouse);
    revalidatePath(KnownPages.RaisedBed(target.raisedBedId));
    if (target.accountId) {
        revalidatePath(KnownPages.Account(target.accountId));
    }
    if (target.gardenId) {
        revalidatePath(KnownPages.Garden(target.gardenId));
    }
}

function approvedPlantStatusNotificationCopy({
    plantName,
    positionIndex,
    raisedBedName,
    status,
}: {
    plantName: string;
    positionIndex: number;
    raisedBedName: string;
    status: string;
}) {
    const location = `U gredici **${raisedBedName}** na poziciji **${positionIndex + 1}**`;
    switch (status) {
        case 'planned':
            return {
                header: `📅 Biljka ${plantName} je na rasporedu!`,
                content: `${location} biljka **${plantName}** je na rasporedu za sijanje.`,
            };
        case 'sowed':
            return {
                header: `Biljka ${plantName} je posijana!`,
                content: `${location} posijana je biljka **${plantName}**.`,
            };
        case 'sprouted':
            return {
                header: `🌱 Proklijala je biljka ${plantName}!`,
                content: `${location} proklijala je biljka **${plantName}**.`,
            };
        case 'notSprouted':
            return {
                header: `😢 Biljka ${plantName} nije proklijala!`,
                content: `${location} biljka **${plantName}** nije proklijala. Polje je spremno za nove biljke.`,
            };
        case 'died':
            return {
                header: `😢 Biljka ${plantName} nije uspjela!`,
                content: `${location} biljka **${plantName}** nije uspjela. Polje je spremno za nove biljke.`,
            };
        case 'firstFlowers':
            return {
                header: `🌸 Biljka ${plantName} je procvjetala!`,
                content: `${location} biljka **${plantName}** je razvila prve cvjetove.`,
            };
        case 'firstFruitSet':
            return {
                header: `🍅 Biljka ${plantName} ima prve plodove!`,
                content: `${location} biljka **${plantName}** je razvila prve plodove.`,
            };
        case 'ready':
            return {
                header: `🌿 Biljka ${plantName} je spremna za berbu!`,
                content: `${location} biljka **${plantName}** je spremna za berbu.`,
            };
        case 'harvested':
            return {
                header: `🌾 Biljka ${plantName} je ubrana!`,
                content: `${location} biljka **${plantName}** je ubrana. Polje je spremno za nove biljke.`,
            };
        case 'removed':
            return {
                header: `🧹 Biljka ${plantName} je uklonjena!`,
                content: `${location} biljka **${plantName}** je uklonjena. Polje je spremno za nove biljke.`,
            };
        default:
            return null;
    }
}

async function notifyApprovedPlantStatus(
    request: Awaited<ReturnType<typeof approvePlantStatusApprovalRequest>>,
) {
    const target = request.target;
    if (!target.plantSortId || !request.reviewedAt) {
        return;
    }
    const [raisedBed, plantSort] = await Promise.all([
        getRaisedBed(target.raisedBedId),
        getEntityFormatted<EntityStandardized>(target.plantSortId),
    ]);
    const plantName = plantSort?.information?.name;
    if (!raisedBed?.accountId || !plantName) {
        return;
    }
    const copy = approvedPlantStatusNotificationCopy({
        plantName,
        positionIndex: target.positionIndex,
        raisedBedName: raisedBed.name,
        status: target.requestedStatus,
    });
    if (!copy) {
        return;
    }

    await createNotification(
        {
            accountId: raisedBed.accountId,
            gardenId: raisedBed.gardenId,
            raisedBedId: raisedBed.id,
            ...copy,
            linkUrl: raisedBed.name
                ? getRaisedBedCloseupUrl(raisedBed.name, {
                      positionIndex: target.positionIndex,
                  })
                : undefined,
            timestamp: request.reviewedAt,
        },
        {
            idempotencyKey: `approval-request:plant-status:${request.id}`,
        },
    );
}

export async function approveApprovalRequestAction(requestId: string) {
    const { userId } = await auth(['admin']);
    const request = await approvePlantStatusApprovalRequest({
        requestId,
        reviewedBy: userId,
    });
    await notifyApprovedPlantStatus(request);
    revalidateApprovedPlantStatusPaths(request);
    revalidateApprovalQueues();
}

export async function rejectApprovalRequestAction(requestId: string) {
    const { userId } = await auth(['admin']);
    await rejectApprovalRequest(requestId, userId);
    revalidateApprovalQueues();
}

export async function approveScheduleOperationTaskAction(
    operationId: number,
    expectedEntityId: number,
    expectedTaskVersionEventId: number,
) {
    await completeOperation(
        operationId,
        expectedEntityId,
        expectedTaskVersionEventId,
    );
    revalidateApprovalQueues();
}

export async function approveSchedulePlantingTaskAction(
    raisedBedId: number,
    positionIndex: number,
    expectedPlantCycleEventId: number,
    expectedPlantSortId: number,
    expectedPlantCycleVersionEventId: number,
) {
    await verifyRaisedBedPlantingAction(
        raisedBedId,
        positionIndex,
        expectedPlantCycleEventId,
        expectedPlantSortId,
        expectedPlantCycleVersionEventId,
    );
    revalidateApprovalQueues();
}
