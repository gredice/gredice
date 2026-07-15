import 'server-only';

import {
    type EntityStandardized,
    getEntitiesFormatted,
    getFarmUserAcceptedOperationById,
    getFarmUserRaisedBeds,
    getOperationById,
    getRaisedBed,
} from '@gredice/storage';
import {
    getScheduleOperationCompletionRequirements,
    getScheduleOperationCompletionRequirementsFingerprint,
    type ScheduleOperationCompletionRequirementsFingerprint,
} from './scheduleOperationRequirements';
import {
    getScheduleOperationTaskAssignment,
    getSchedulePlantingTaskAssignment,
} from './scheduleTaskAssignment';
import type { ScheduleTaskBlockerTarget } from './scheduleTaskBlocker';
import type { ScheduleTaskSubmissionFailure } from './scheduleTaskSubmissionResult';

type ScheduleTaskUploadActor = {
    role: string;
    userId: string;
};

export type ScheduleTaskUploadTargetValidationResult =
    | { success: true }
    | ScheduleTaskSubmissionFailure;

function uploadTargetFailure(
    code: ScheduleTaskSubmissionFailure['code'],
    message: string,
): ScheduleTaskSubmissionFailure {
    return {
        canRetry: false,
        code,
        message,
        success: false,
    };
}

export class ScheduleTaskUploadTargetError extends Error {
    readonly canRetry: boolean;
    readonly code: ScheduleTaskSubmissionFailure['code'];

    constructor(failure: ScheduleTaskSubmissionFailure) {
        super(failure.message);
        this.name = 'ScheduleTaskUploadTargetError';
        this.canRetry = failure.canRetry;
        this.code = failure.code;
    }
}

export function assertScheduleTaskUploadTarget(
    result: ScheduleTaskUploadTargetValidationResult,
) {
    if (!result.success) {
        throw new ScheduleTaskUploadTargetError(result);
    }
}

export async function validateScheduleOperationUploadTarget({
    actor,
    expectedEntityId,
    expectedRequirementsFingerprint,
    expectedTaskVersionEventId,
    operationId,
    purpose,
}: {
    actor: ScheduleTaskUploadActor;
    expectedEntityId: number;
    expectedRequirementsFingerprint?: ScheduleOperationCompletionRequirementsFingerprint;
    expectedTaskVersionEventId: number;
    operationId: number;
    purpose: 'blocker' | 'completion';
}): Promise<ScheduleTaskUploadTargetValidationResult> {
    const operation =
        actor.role === 'admin'
            ? await getOperationById(operationId)
            : await getFarmUserAcceptedOperationById(actor.userId, operationId);

    if (!operation) {
        return uploadTargetFailure(
            'not_authorized',
            'Više nemaš pristup ovom zadatku. Osvježi zadatke za aktualno stanje.',
        );
    }
    if (operation.entityId !== expectedEntityId) {
        return uploadTargetFailure(
            'task_changed',
            'Radnja se u međuvremenu promijenila. Osvježi zadatke i pokušaj ponovno.',
        );
    }
    if (operation.taskVersionEventId !== expectedTaskVersionEventId) {
        return uploadTargetFailure(
            'task_changed',
            'Radnja se u međuvremenu promijenila. Osvježi zadatke i pokušaj ponovno.',
        );
    }
    if (operation.raisedBedId !== null) {
        const raisedBed = await getRaisedBed(operation.raisedBedId);
        if (!raisedBed || raisedBed.status === 'abandoned') {
            return uploadTargetFailure(
                'invalid_status',
                'Gredica više nije aktivna. Osvježi zadatke za aktualno stanje.',
            );
        }
    }
    if (
        actor.role !== 'admin' &&
        getScheduleOperationTaskAssignment(operation, actor.userId) === 'other'
    ) {
        return uploadTargetFailure(
            'assignment_changed',
            'Ovaj je zadatak u međuvremenu dodijeljen drugom korisniku.',
        );
    }
    if (operation.status !== 'new' && operation.status !== 'planned') {
        return uploadTargetFailure(
            'invalid_status',
            purpose === 'completion'
                ? 'Radnja više nije dostupna za dovršetak. Osvježi zadatke.'
                : 'Radnja više nije dostupna za prijavu prepreke. Osvježi zadatke.',
        );
    }

    if (purpose === 'completion') {
        const definitions =
            await getEntitiesFormatted<EntityStandardized>('operation');
        const definition = definitions?.find(
            (candidate) => candidate.id === operation.entityId,
        );
        if (!definition || !expectedRequirementsFingerprint) {
            return uploadTargetFailure(
                'task_changed',
                'Zahtjevi za dovršetak radnje promijenili su se. Osvježi zadatke.',
            );
        }
        const currentFingerprint =
            getScheduleOperationCompletionRequirementsFingerprint(
                getScheduleOperationCompletionRequirements(definition),
            );
        if (currentFingerprint !== expectedRequirementsFingerprint) {
            return uploadTargetFailure(
                'task_changed',
                'Zahtjevi za dovršetak radnje promijenili su se. Osvježi zadatke.',
            );
        }
    }

    return { success: true };
}

export async function validateScheduleTaskBlockerUploadTarget({
    actor,
    target,
}: {
    actor: ScheduleTaskUploadActor;
    target: ScheduleTaskBlockerTarget;
}): Promise<ScheduleTaskUploadTargetValidationResult> {
    if (target.kind === 'operation') {
        return validateScheduleOperationUploadTarget({
            actor,
            expectedEntityId: target.expectedEntityId,
            expectedTaskVersionEventId: target.expectedTaskVersionEventId,
            operationId: target.operationId,
            purpose: 'blocker',
        });
    }

    const raisedBeds =
        actor.role === 'admin'
            ? [await getRaisedBed(target.raisedBedId)]
            : await getFarmUserRaisedBeds(actor.userId);
    const raisedBed = raisedBeds.find(
        (candidate) => candidate?.id === target.raisedBedId,
    );
    const field = raisedBed?.fields.find(
        (candidate) =>
            candidate.positionIndex === target.positionIndex &&
            candidate.active,
    );
    if (!raisedBed || !field) {
        return uploadTargetFailure(
            'not_authorized',
            'Više nemaš pristup ovom sijanju. Osvježi zadatke za aktualno stanje.',
        );
    }
    if (raisedBed.status === 'abandoned') {
        return uploadTargetFailure(
            'invalid_status',
            'Gredica više nije aktivna. Osvježi zadatke za aktualno stanje.',
        );
    }
    const activePlantCycle = field.plantCycles.find(
        (plantCycle) => plantCycle.active,
    );
    if (
        activePlantCycle?.plantPlaceEventId !==
            target.expectedPlantCycleEventId ||
        activePlantCycle?.endedEventId !==
            target.expectedPlantCycleVersionEventId ||
        field.plantSortId !== target.expectedPlantSortId
    ) {
        return uploadTargetFailure(
            'task_changed',
            'Sijanje se u međuvremenu promijenilo. Osvježi zadatke i pokušaj ponovno.',
        );
    }
    if (
        actor.role !== 'admin' &&
        getSchedulePlantingTaskAssignment(field, actor.userId) === 'other'
    ) {
        return uploadTargetFailure(
            'assignment_changed',
            'Ovo je sijanje u međuvremenu dodijeljeno drugom korisniku.',
        );
    }
    if (field.plantStatus !== 'planned') {
        return uploadTargetFailure(
            'invalid_status',
            'Sijanje više nije dostupno za prijavu prepreke. Osvježi zadatke.',
        );
    }

    return { success: true };
}
