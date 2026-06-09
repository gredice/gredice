'use server';

import {
    approveApprovalRequest,
    getApprovalRequest,
    getRaisedBed,
    rejectApprovalRequest,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';
import { completeOperation } from './operationActions';
import {
    raisedBedFieldUpdatePlant,
    verifyRaisedBedPlantingAction,
} from './raisedBedFieldsActions';

function revalidateApprovalQueues() {
    revalidatePath(KnownPages.Approvals);
    revalidatePath(KnownPages.Schedule);
}

export async function approveApprovalRequestAction(requestId: string) {
    const { userId } = await auth(['admin']);
    const request = await getApprovalRequest(requestId);
    if (!request) {
        throw new Error('Zahtjev za odobrenje nije pronađen.');
    }

    if (request.status !== 'pending') {
        revalidateApprovalQueues();
        return;
    }

    if (request.target.kind === 'raisedBedField.plantStatus') {
        const raisedBed = await getRaisedBed(request.target.raisedBedId);
        const field = raisedBed?.fields.find(
            (candidate) =>
                candidate.positionIndex === request.target.positionIndex &&
                candidate.active,
        );

        if (!raisedBed || !field) {
            throw new Error('Biljka za odobrenje više nije dostupna.');
        }

        if (
            request.target.currentStatus &&
            field.plantStatus !== request.target.currentStatus
        ) {
            throw new Error(
                'Stanje biljke se promijenilo nakon slanja zahtjeva.',
            );
        }

        if (
            request.target.requestedStatus === 'readyForTransplanting' &&
            field.sowingLocation !== 'greenhouse'
        ) {
            throw new Error(
                'Stanje spremnosti za presađivanje može se odobriti samo za biljke iz staklenika.',
            );
        }

        await raisedBedFieldUpdatePlant({
            raisedBedId: request.target.raisedBedId,
            positionIndex: request.target.positionIndex,
            status: request.target.requestedStatus,
            plantSortId: field.plantSortId,
        });
    }

    await approveApprovalRequest(requestId, userId);
    revalidateApprovalQueues();
}

export async function rejectApprovalRequestAction(requestId: string) {
    const { userId } = await auth(['admin']);
    await rejectApprovalRequest(requestId, userId);
    revalidateApprovalQueues();
}

export async function approveScheduleOperationTaskAction(operationId: number) {
    await completeOperation(operationId);
    revalidateApprovalQueues();
}

export async function approveSchedulePlantingTaskAction(
    raisedBedId: number,
    positionIndex: number,
) {
    await verifyRaisedBedPlantingAction(raisedBedId, positionIndex);
    revalidateApprovalQueues();
}
