'use server';

import {
    type EntityStandardized,
    getEntitiesFormatted,
    getFarmUserPrintableHarvestTraceLinkIds,
    markHarvestTraceLinksPrinted,
    ScheduleTaskSubmissionError,
    submitOperationTaskBlock,
    submitOperationTaskCompletion,
    submitPlantingTaskBlock,
    submitPlantingTaskCompletion,
} from '@gredice/storage';
import { head } from '@vercel/blob';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';
import {
    assertFarmOperationCompletionImagesStored,
    FarmOperationCompletionImagesValidationError,
    normalizeFarmOperationCompletionImageUrls,
} from './operationCompletionProof';
import {
    assertScheduleOperationCompletionProof,
    getScheduleOperationCompletionRequirements,
    getScheduleOperationCompletionRequirementsFingerprint,
    parseScheduleOperationCompletionRequirementsFingerprint,
    type ScheduleOperationCompletionRequirementsFingerprint,
} from './scheduleOperationRequirements';
import {
    getScheduleTaskBlockerReason,
    parseScheduleTaskBlockerTarget,
    type ScheduleTaskBlockerReasonCode,
    type ScheduleTaskBlockerTarget,
    scheduleTaskBlockerReasonRequiresNote,
} from './scheduleTaskBlocker';
import {
    assertScheduleTaskBlockerImagesStored,
    normalizeScheduleTaskBlockerImageUrls,
    ScheduleTaskBlockerImagesValidationError,
} from './scheduleTaskBlockerProof';
import {
    assertNonNegativeSafeInteger,
    assertPositiveSafeInteger,
} from './scheduleTaskInput';
import type {
    ScheduleTaskSubmissionFailure,
    ScheduleTaskSubmissionState,
    ScheduleTaskSubmissionSuccess,
} from './scheduleTaskSubmissionResult';
import {
    validateScheduleOperationUploadTarget,
    validateScheduleTaskBlockerUploadTarget,
} from './scheduleTaskUploadValidation';

const MAX_COMPLETION_NOTES_LENGTH = 2000;

function normalizeCompletionNotes(notes?: string) {
    const normalizedNotes = notes?.trim();
    if (!normalizedNotes) {
        return undefined;
    }

    if (normalizedNotes.length > MAX_COMPLETION_NOTES_LENGTH) {
        throw new Error('Napomena može imati najviše 2000 znakova.');
    }

    return normalizedNotes;
}

function revalidateSchedule() {
    revalidatePath('/');
    revalidatePath('/schedule');
}

function getTaskActor(
    userId: string,
    role: string,
): { userId: string; role: 'admin' | 'farmer' } {
    return {
        userId,
        role: role === 'admin' ? 'admin' : 'farmer',
    };
}

function completionState(
    status: string,
): Exclude<ScheduleTaskSubmissionState, 'blocked'> {
    if (status === 'completed' || status === 'sowed') {
        return 'completed';
    }
    if (status === 'pendingVerification') {
        return 'pendingVerification';
    }

    throw new Error(`Unexpected completion status: ${status}`);
}

function actionResult<State extends ScheduleTaskSubmissionState>(
    state: State,
    occurredAt: Date,
): ScheduleTaskSubmissionSuccess & { state: State } {
    return {
        recordedAt: occurredAt.toISOString(),
        state,
        success: true,
    };
}

function submissionFailure(
    error: unknown,
): ScheduleTaskSubmissionFailure | null {
    if (!(error instanceof ScheduleTaskSubmissionError)) {
        return null;
    }

    return {
        canRetry: error.code === 'invalid_input',
        code: error.code,
        message: error.message,
        success: false,
    };
}

function taskChangedFailure(message: string): ScheduleTaskSubmissionFailure {
    return {
        canRetry: false,
        code: 'task_changed',
        message,
        success: false,
    };
}

function notAuthorizedFailure(): ScheduleTaskSubmissionFailure {
    return {
        canRetry: false,
        code: 'not_authorized',
        message:
            'Sesija je istekla ili više nemaš pristup zadatku. Osvježi stranicu i prijavi se ponovno.',
        success: false,
    };
}

function isScheduleTaskAuthenticationError(error: unknown) {
    if (!(error instanceof Error)) {
        return false;
    }

    return (
        error.message === 'Unauthorized' ||
        error.message.startsWith('Unauthorized:') ||
        error.message === 'User not found' ||
        error.message === 'Account not found'
    );
}

async function getScheduleTaskAuthContext() {
    try {
        return {
            context: await auth(['admin', 'farmer']),
            failure: null,
        };
    } catch (error) {
        if (!isScheduleTaskAuthenticationError(error)) {
            throw error;
        }

        return {
            context: null,
            failure: notAuthorizedFailure(),
        };
    }
}

function retryableProofFailure(
    error:
        | FarmOperationCompletionImagesValidationError
        | ScheduleTaskBlockerImagesValidationError,
): ScheduleTaskSubmissionFailure {
    return {
        canRetry: true,
        code: 'invalid_input',
        message: error.message,
        retryImageUrls: error.imageUrls,
        success: false,
    };
}

export async function validateFarmOperationUploadTarget(
    operationId: number,
    expectedEntityId: number,
    expectedTaskVersionEventId: number,
    expectedRequirementsFingerprint: ScheduleOperationCompletionRequirementsFingerprint,
) {
    const authorization = await getScheduleTaskAuthContext();
    if (authorization.failure) {
        return authorization.failure;
    }
    const {
        user: { role },
        userId,
    } = authorization.context;
    let target: Omit<
        Parameters<typeof validateScheduleOperationUploadTarget>[0],
        'actor' | 'purpose'
    >;
    try {
        target = {
            expectedEntityId: assertPositiveSafeInteger(
                expectedEntityId,
                'ID vrste radnje nije ispravan.',
            ),
            expectedTaskVersionEventId: assertNonNegativeSafeInteger(
                expectedTaskVersionEventId,
                'Verzija radnje nije ispravna.',
            ),
            expectedRequirementsFingerprint:
                parseScheduleOperationCompletionRequirementsFingerprint(
                    expectedRequirementsFingerprint,
                ),
            operationId: assertPositiveSafeInteger(
                operationId,
                'ID radnje nije ispravan.',
            ),
        };
    } catch {
        return taskChangedFailure(
            'Podaci zadatka više nisu aktualni. Osvježi zadatke i pokušaj ponovno.',
        );
    }

    return await validateScheduleOperationUploadTarget({
        actor: { role, userId },
        ...target,
        purpose: 'completion',
    });
}

export async function validateFarmScheduleBlockerUploadTarget(
    targetInput: ScheduleTaskBlockerTarget,
) {
    const authorization = await getScheduleTaskAuthContext();
    if (authorization.failure) {
        return authorization.failure;
    }
    const {
        user: { role },
        userId,
    } = authorization.context;
    let target: ScheduleTaskBlockerTarget;
    try {
        target = parseScheduleTaskBlockerTarget(targetInput);
    } catch {
        return taskChangedFailure(
            'Podaci zadatka više nisu aktualni. Osvježi zadatke i pokušaj ponovno.',
        );
    }

    return await validateScheduleTaskBlockerUploadTarget({
        actor: { role, userId },
        target,
    });
}

export async function completeFarmOperation(
    operationId: number,
    expectedEntityId: number,
    expectedTaskVersionEventId: number,
    expectedRequirementsFingerprint: ScheduleOperationCompletionRequirementsFingerprint,
    imageUrls?: string[],
    notes?: string,
) {
    const authorization = await getScheduleTaskAuthContext();
    if (authorization.failure) {
        return authorization.failure;
    }
    const {
        user: { role },
        userId,
    } = authorization.context;
    const validOperationId = assertPositiveSafeInteger(
        operationId,
        'ID radnje nije ispravan.',
    );
    const validExpectedEntityId = assertPositiveSafeInteger(
        expectedEntityId,
        'ID vrste radnje nije ispravan.',
    );
    const validExpectedTaskVersionEventId = assertNonNegativeSafeInteger(
        expectedTaskVersionEventId,
        'Verzija radnje nije ispravna.',
    );
    let validExpectedRequirementsFingerprint: ScheduleOperationCompletionRequirementsFingerprint;
    try {
        validExpectedRequirementsFingerprint =
            parseScheduleOperationCompletionRequirementsFingerprint(
                expectedRequirementsFingerprint,
            );
    } catch {
        return taskChangedFailure(
            'Zahtjevi za dovršetak radnje promijenili su se. Osvježi zadatke.',
        );
    }
    const completionImageUrls = normalizeFarmOperationCompletionImageUrls(
        imageUrls,
        validOperationId,
        validExpectedEntityId,
        validExpectedTaskVersionEventId,
    );
    const completionNotes = normalizeCompletionNotes(notes);

    const uploadTargetValidation = await validateScheduleOperationUploadTarget({
        actor: { role, userId },
        expectedEntityId: validExpectedEntityId,
        expectedRequirementsFingerprint: validExpectedRequirementsFingerprint,
        expectedTaskVersionEventId: validExpectedTaskVersionEventId,
        operationId: validOperationId,
        purpose: 'completion',
    });
    if (!uploadTargetValidation.success) {
        return uploadTargetValidation;
    }

    const operationDefinitions =
        await getEntitiesFormatted<EntityStandardized>('operation');
    const operationDefinition = operationDefinitions?.find(
        (candidate) => candidate.id === validExpectedEntityId,
    );
    if (!operationDefinition) {
        return taskChangedFailure(
            'Zahtjevi za dovršetak radnje trenutno nisu dostupni. Osvježi zadatke.',
        );
    }
    const currentRequirements =
        getScheduleOperationCompletionRequirements(operationDefinition);
    if (
        getScheduleOperationCompletionRequirementsFingerprint(
            currentRequirements,
        ) !== validExpectedRequirementsFingerprint
    ) {
        return taskChangedFailure(
            'Zahtjevi za dovršetak radnje promijenili su se. Osvježi zadatke.',
        );
    }
    try {
        assertScheduleOperationCompletionProof(currentRequirements, {
            imageUrls: completionImageUrls,
            notes: completionNotes,
        });
    } catch (error) {
        return {
            canRetry: true,
            code: 'invalid_input' as const,
            message:
                error instanceof Error
                    ? error.message
                    : 'Dokaz dovršetka nije ispravan.',
            success: false as const,
        };
    }
    try {
        await assertFarmOperationCompletionImagesStored(
            completionImageUrls,
            validOperationId,
            validExpectedEntityId,
            validExpectedTaskVersionEventId,
            head,
        );
    } catch (error) {
        if (error instanceof FarmOperationCompletionImagesValidationError) {
            return retryableProofFailure(error);
        }
        throw error;
    }

    let result: Awaited<ReturnType<typeof submitOperationTaskCompletion>>;
    try {
        result = await submitOperationTaskCompletion({
            actor: getTaskActor(userId, role),
            expectedEntityId: validExpectedEntityId,
            expectedTaskVersionEventId: validExpectedTaskVersionEventId,
            imageUrls: completionImageUrls,
            notes: completionNotes,
            operationId: validOperationId,
        });
    } catch (error) {
        const failure = submissionFailure(error);
        if (failure) {
            return failure;
        }
        throw error;
    }

    return actionResult(completionState(result.status), result.occurredAt);
}

export async function completeFarmOperationWithImageUrls(
    operationId: number,
    expectedEntityId: number,
    expectedTaskVersionEventId: number,
    expectedRequirementsFingerprint: ScheduleOperationCompletionRequirementsFingerprint,
    imageUrls: string[],
    notes?: string,
) {
    return completeFarmOperation(
        operationId,
        expectedEntityId,
        expectedTaskVersionEventId,
        expectedRequirementsFingerprint,
        imageUrls,
        notes,
    );
}

export async function completeFarmPlanting(
    raisedBedId: number,
    positionIndex: number,
    expectedPlantCycleEventId: number,
    expectedPlantCycleVersionEventId: number,
    expectedPlantSortId: number,
) {
    const authorization = await getScheduleTaskAuthContext();
    if (authorization.failure) {
        return authorization.failure;
    }
    const {
        user: { role },
        userId,
    } = authorization.context;
    const validRaisedBedId = assertPositiveSafeInteger(
        raisedBedId,
        'ID gredice nije ispravan.',
    );
    const validPositionIndex = assertNonNegativeSafeInteger(
        positionIndex,
        'Pozicija sijanja nije ispravna.',
    );
    const validExpectedPlantCycleEventId = assertPositiveSafeInteger(
        expectedPlantCycleEventId,
        'ID ciklusa biljke nije ispravan.',
    );
    const validExpectedPlantCycleVersionEventId = assertPositiveSafeInteger(
        expectedPlantCycleVersionEventId,
        'Verzija ciklusa biljke nije ispravna.',
    );
    const validExpectedPlantSortId = assertPositiveSafeInteger(
        expectedPlantSortId,
        'ID sorte biljke nije ispravan.',
    );

    let result: Awaited<ReturnType<typeof submitPlantingTaskCompletion>>;
    try {
        result = await submitPlantingTaskCompletion({
            actor: getTaskActor(userId, role),
            expectedPlantCycleEventId: validExpectedPlantCycleEventId,
            expectedPlantCycleVersionEventId:
                validExpectedPlantCycleVersionEventId,
            expectedPlantSortId: validExpectedPlantSortId,
            positionIndex: validPositionIndex,
            raisedBedId: validRaisedBedId,
        });
    } catch (error) {
        const failure = submissionFailure(error);
        if (failure) {
            return failure;
        }
        throw error;
    }

    return actionResult(completionState(result.status), result.occurredAt);
}

export async function blockFarmScheduleTask(
    targetInput: ScheduleTaskBlockerTarget,
    reasonCodeInput: ScheduleTaskBlockerReasonCode,
    note?: string,
    imageUrls?: string[],
) {
    const authorization = await getScheduleTaskAuthContext();
    if (authorization.failure) {
        return authorization.failure;
    }
    const {
        user: { role },
        userId,
    } = authorization.context;
    const target = parseScheduleTaskBlockerTarget(targetInput);
    const reason = getScheduleTaskBlockerReason(reasonCodeInput);
    const normalizedNote = normalizeCompletionNotes(note);
    if (scheduleTaskBlockerReasonRequiresNote(reason.code) && !normalizedNote) {
        throw new Error('Za odabrani razlog napiši kratko objašnjenje.');
    }

    const normalizedImageUrls = normalizeScheduleTaskBlockerImageUrls(
        imageUrls,
        target,
    );
    const actor = getTaskActor(userId, role);
    const uploadTargetValidation =
        await validateScheduleTaskBlockerUploadTarget({ actor, target });
    if (!uploadTargetValidation.success) {
        return uploadTargetValidation;
    }
    try {
        await assertScheduleTaskBlockerImagesStored(
            normalizedImageUrls,
            target,
            head,
        );
    } catch (error) {
        if (error instanceof ScheduleTaskBlockerImagesValidationError) {
            return retryableProofFailure(error);
        }
        throw error;
    }

    let result:
        | Awaited<ReturnType<typeof submitOperationTaskBlock>>
        | Awaited<ReturnType<typeof submitPlantingTaskBlock>>;
    try {
        result =
            target.kind === 'operation'
                ? await submitOperationTaskBlock({
                      actor,
                      expectedEntityId: target.expectedEntityId,
                      expectedTaskVersionEventId:
                          target.expectedTaskVersionEventId,
                      imageUrls: normalizedImageUrls,
                      note: normalizedNote,
                      operationId: target.operationId,
                      reasonCode: reason.code,
                  })
                : await submitPlantingTaskBlock({
                      actor,
                      expectedPlantCycleEventId:
                          target.expectedPlantCycleEventId,
                      expectedPlantCycleVersionEventId:
                          target.expectedPlantCycleVersionEventId,
                      expectedPlantSortId: target.expectedPlantSortId,
                      imageUrls: normalizedImageUrls,
                      note: normalizedNote,
                      positionIndex: target.positionIndex,
                      raisedBedId: target.raisedBedId,
                      reasonCode: reason.code,
                  });
    } catch (error) {
        const failure = submissionFailure(error);
        if (failure) {
            return failure;
        }
        throw error;
    }

    return actionResult('blocked', result.occurredAt);
}

export async function refreshFarmScheduleAfterSubmission() {
    await auth(['admin', 'farmer']);
    revalidateSchedule();
    return { success: true };
}

export async function markHarvestTraceLabelsPrintedAction(
    traceLinkIds: number[],
) {
    const {
        user: { role },
        userId,
    } = await auth(['admin', 'farmer']);

    const printableTraceLinkIds =
        role === 'admin'
            ? traceLinkIds
            : await getFarmUserPrintableHarvestTraceLinkIds(
                  userId,
                  traceLinkIds,
              );

    await markHarvestTraceLinksPrinted(printableTraceLinkIds);
    revalidateSchedule();

    return { success: true };
}
