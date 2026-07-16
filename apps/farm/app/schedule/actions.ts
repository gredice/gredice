'use server';

import {
    type EntityStandardized,
    getEntitiesFormatted,
    getFarmUserPrintableHarvestTraceLinkIds,
    markHarvestTraceLinksPrinted,
    resolveOperationTaskCompletionSubmission,
    ScheduleTaskSubmissionError,
    submitOperationTaskBlock,
    submitOperationTaskCompletion,
    submitPlantingTaskBlock,
    submitPlantingTaskCompletion,
} from '@gredice/storage';
import { BlobNotFoundError, head } from '@vercel/blob';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';
import {
    assertFarmOperationCompletionImagesStored,
    FarmOperationCompletionImageMetadataUnavailableError,
    FarmOperationCompletionImagesValidationError,
    getFarmOperationCompletionSubmissionImagePath,
    normalizeFarmOperationCompletionImageUrls,
    parseFarmOperationCompletionAttachmentId,
    parseFarmOperationCompletionSubmissionId,
} from './operationCompletionProof';
import {
    assertScheduleOperationCompletionProof,
    getScheduleOperationCompletionRequirements,
    getScheduleOperationCompletionRequirementsFingerprint,
    parseScheduleOperationCompletionRequirementsFingerprint,
    type ScheduleOperationCompletionRequirementsFingerprint,
} from './scheduleOperationRequirements';
import { getExpectedScheduleTaskAccountId } from './scheduleTaskAccountScope';
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

function invalidSubmissionFailure(
    message: string,
): ScheduleTaskSubmissionFailure {
    return {
        canRetry: false,
        code: 'invalid_input',
        message,
        success: false,
    };
}

function submissionConflictFailure(
    message: string,
): ScheduleTaskSubmissionFailure {
    return {
        canRetry: false,
        code: 'submission_conflict',
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

async function loadFarmOperationCompletionImageMetadata(imageUrl: string) {
    try {
        return await head(imageUrl);
    } catch (error) {
        if (error instanceof BlobNotFoundError) {
            throw error;
        }
        throw new FarmOperationCompletionImageMetadataUnavailableError();
    }
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
        accountId,
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
        expectedAccountId: getExpectedScheduleTaskAccountId(accountId, role),
        ...target,
        purpose: 'completion',
    });
}

export async function recoverFarmOperationCompletionImage(
    operationId: number,
    expectedEntityId: number,
    expectedTaskVersionEventId: number,
    expectedRequirementsFingerprint: ScheduleOperationCompletionRequirementsFingerprint,
    submissionId: string,
    attachmentId: string,
    fileName: string,
) {
    const authorization = await getScheduleTaskAuthContext();
    if (authorization.failure) {
        return authorization.failure;
    }
    const {
        accountId,
        user: { role },
        userId,
    } = authorization.context;

    let target: {
        attachmentId: string;
        expectedEntityId: number;
        expectedRequirementsFingerprint: ScheduleOperationCompletionRequirementsFingerprint;
        expectedTaskVersionEventId: number;
        fileName: string;
        operationId: number;
        submissionId: string;
    };
    try {
        if (typeof fileName !== 'string') {
            throw new Error('Invalid file name');
        }
        target = {
            attachmentId:
                parseFarmOperationCompletionAttachmentId(attachmentId),
            expectedEntityId: assertPositiveSafeInteger(
                expectedEntityId,
                'ID vrste radnje nije ispravan.',
            ),
            expectedRequirementsFingerprint:
                parseScheduleOperationCompletionRequirementsFingerprint(
                    expectedRequirementsFingerprint,
                ),
            expectedTaskVersionEventId: assertNonNegativeSafeInteger(
                expectedTaskVersionEventId,
                'Verzija radnje nije ispravna.',
            ),
            fileName,
            operationId: assertPositiveSafeInteger(
                operationId,
                'ID radnje nije ispravan.',
            ),
            submissionId:
                parseFarmOperationCompletionSubmissionId(submissionId),
        };
    } catch {
        return invalidSubmissionFailure(
            'Podaci spremljene fotografije nisu ispravni. Odbaci pokušaj i ponovno odaberi fotografiju.',
        );
    }

    const uploadTargetValidation = await validateScheduleOperationUploadTarget({
        actor: { role, userId },
        expectedAccountId: getExpectedScheduleTaskAccountId(accountId, role),
        expectedEntityId: target.expectedEntityId,
        expectedRequirementsFingerprint: target.expectedRequirementsFingerprint,
        expectedTaskVersionEventId: target.expectedTaskVersionEventId,
        operationId: target.operationId,
        purpose: 'completion',
    });
    if (!uploadTargetValidation.success) {
        return uploadTargetValidation;
    }

    const pathname = getFarmOperationCompletionSubmissionImagePath(
        target.operationId,
        target.expectedEntityId,
        target.expectedTaskVersionEventId,
        target.submissionId,
        target.attachmentId,
        target.fileName,
    );
    let metadata: Awaited<ReturnType<typeof head>>;
    try {
        metadata = await head(pathname);
    } catch (error) {
        if (error instanceof BlobNotFoundError) {
            return { imageUrl: null, success: true as const };
        }
        throw error;
    }

    if (metadata.pathname !== pathname) {
        return submissionConflictFailure(
            'Spremljena fotografija ne odgovara ovom pokušaju. Pregledaj pokušaj prije ponovnog slanja.',
        );
    }
    try {
        const normalizedImageUrls = normalizeFarmOperationCompletionImageUrls(
            [metadata.url],
            target.operationId,
            target.expectedEntityId,
            target.expectedTaskVersionEventId,
            target.submissionId,
        );
        if (normalizedImageUrls?.length !== 1) {
            return submissionConflictFailure(
                'Spremljena fotografija nije valjana za ovaj pokušaj. Pregledaj pokušaj prije ponovnog slanja.',
            );
        }
        await assertFarmOperationCompletionImagesStored(
            normalizedImageUrls,
            target.operationId,
            target.expectedEntityId,
            target.expectedTaskVersionEventId,
            async () => metadata,
            target.submissionId,
        );
    } catch {
        return submissionConflictFailure(
            'Spremljena fotografija nije valjana za ovaj pokušaj. Pregledaj pokušaj prije ponovnog slanja.',
        );
    }

    return { imageUrl: metadata.url, success: true as const };
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
    submissionId?: string,
) {
    const authorization = await getScheduleTaskAuthContext();
    if (authorization.failure) {
        return authorization.failure;
    }
    const {
        accountId,
        user: { role },
        userId,
    } = authorization.context;
    const keyedSubmission = submissionId !== undefined;
    let validOperationId: number;
    let validExpectedEntityId: number;
    let validExpectedTaskVersionEventId: number;
    try {
        validOperationId = assertPositiveSafeInteger(
            operationId,
            'ID radnje nije ispravan.',
        );
        validExpectedEntityId = assertPositiveSafeInteger(
            expectedEntityId,
            'ID vrste radnje nije ispravan.',
        );
        validExpectedTaskVersionEventId = assertNonNegativeSafeInteger(
            expectedTaskVersionEventId,
            'Verzija radnje nije ispravna.',
        );
    } catch (error) {
        if (!keyedSubmission) {
            throw error;
        }
        return invalidSubmissionFailure(
            'Spremljeni pokušaj više nema ispravan identitet zadatka. Odbaci ga i pokušaj ponovno.',
        );
    }
    let validSubmissionId: string | undefined;
    try {
        validSubmissionId = keyedSubmission
            ? parseFarmOperationCompletionSubmissionId(submissionId)
            : undefined;
    } catch {
        return invalidSubmissionFailure(
            'Spremljeni pokušaj slanja nije ispravan. Odbaci ga i pokušaj ponovno.',
        );
    }
    let completionImageUrls: string[] | undefined;
    let completionNotes: string | undefined;
    try {
        completionImageUrls = normalizeFarmOperationCompletionImageUrls(
            imageUrls,
            validOperationId,
            validExpectedEntityId,
            validExpectedTaskVersionEventId,
            validSubmissionId,
        );
        completionNotes = normalizeCompletionNotes(notes);
    } catch (error) {
        if (!validSubmissionId) {
            throw error;
        }
        return invalidSubmissionFailure(
            'Spremljeni pokušaj sadrži neispravne podatke. Pregledaj ga ili ga odbaci prije ponovnog slanja.',
        );
    }
    const actor = getTaskActor(userId, role);
    const expectedAccountId = getExpectedScheduleTaskAccountId(accountId, role);

    if (validSubmissionId) {
        try {
            const replay = await resolveOperationTaskCompletionSubmission({
                actor,
                expectedAccountId,
                expectedEntityId: validExpectedEntityId,
                expectedTaskVersionEventId: validExpectedTaskVersionEventId,
                imageUrls: completionImageUrls,
                notes: completionNotes,
                operationId: validOperationId,
                submissionId: validSubmissionId,
            });
            if (replay) {
                return actionResult(
                    completionState(replay.status),
                    replay.occurredAt,
                );
            }
        } catch (error) {
            const failure = submissionFailure(error);
            if (failure) {
                return failure;
            }
            throw error;
        }
    }

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

    const uploadTargetValidation = await validateScheduleOperationUploadTarget({
        actor,
        expectedAccountId,
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
        const message =
            error instanceof Error
                ? error.message
                : 'Dokaz dovršetka nije ispravan.';
        if (validSubmissionId) {
            return invalidSubmissionFailure(message);
        }
        return {
            canRetry: true,
            code: 'invalid_input' as const,
            message,
            success: false as const,
        };
    }
    try {
        await assertFarmOperationCompletionImagesStored(
            completionImageUrls,
            validOperationId,
            validExpectedEntityId,
            validExpectedTaskVersionEventId,
            loadFarmOperationCompletionImageMetadata,
            validSubmissionId,
        );
    } catch (error) {
        if (error instanceof FarmOperationCompletionImagesValidationError) {
            if (validSubmissionId && error.reason === 'invalid') {
                return submissionConflictFailure(
                    'Spremljena fotografija ne odgovara ovom pokušaju i ne može se sigurno zamijeniti. Odbaci pokušaj i pošalji ga ponovno.',
                );
            }
            return retryableProofFailure(error);
        }
        throw error;
    }

    let result: Awaited<ReturnType<typeof submitOperationTaskCompletion>>;
    try {
        result = await submitOperationTaskCompletion({
            actor,
            expectedAccountId,
            expectedEntityId: validExpectedEntityId,
            expectedTaskVersionEventId: validExpectedTaskVersionEventId,
            imageUrls: completionImageUrls,
            notes: completionNotes,
            operationId: validOperationId,
            submissionId: validSubmissionId,
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
    submissionId?: string,
) {
    return completeFarmOperation(
        operationId,
        expectedEntityId,
        expectedTaskVersionEventId,
        expectedRequirementsFingerprint,
        imageUrls,
        notes,
        submissionId,
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
