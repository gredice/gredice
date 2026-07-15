'use server';

import {
    isRaisedBedAbandoned,
    RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE,
    RAISED_BED_ABANDONED_DUE_TO_INACTIVITY_MESSAGE,
} from '@gredice/js/raisedBeds';
import {
    getRaisedBedCloseupUrl,
    validateHostedImageUrl,
} from '@gredice/js/urls';
import {
    notifyOperationAssignedUsers,
    notifyOperationUpdate,
} from '@gredice/notifications';
import {
    acceptOperation,
    assignOperationTaskUsers,
    cancelOperationTaskWithRefund,
    createEvent,
    createNotification,
    createOperation,
    deliverNotificationOperatorAlert,
    getAssignableFarmUsersByFarmIds,
    getAssignableFarmUsersByGardenIds,
    getEntitiesFormatted,
    getEntityFormatted,
    getOperationById,
    getRaisedBed,
    type InsertOperation,
    knownEvents,
    submitOperationTaskCompletion,
    switchOperationEntity,
    unacceptOperation,
    updateOperationCompletionEvidence,
    verifyOperationTaskCompletion,
    withOperationScheduleTaskTransaction,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import type { EntityStandardized } from '../../lib/@types/EntityStandardized';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';
import { operationDefinitionMatchesTargetScope } from '../admin/operations/operationScope';
import {
    canAcceptOperationTask,
    canRescheduleOperationTask,
    canSwitchOperationTaskEntity,
    canUnacceptOperationTask,
} from '../admin/schedule/scheduleShared';

const MAX_COMPLETION_NOTES_LENGTH = 2000;
const MAX_COMPLETION_IMAGE_COUNT = 20;

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

function normalizeCompletionImageUrls(
    value: unknown,
    existingImageUrls: string[],
) {
    if (!Array.isArray(value)) {
        throw new Error('Popis slika nije ispravan.');
    }

    const allowedExistingImageUrls = new Set(
        existingImageUrls.map((imageUrl) => imageUrl.trim()).filter(Boolean),
    );
    const uniqueUrls = new Set<string>();
    for (const item of value) {
        if (typeof item !== 'string') {
            throw new Error('Popis slika nije ispravan.');
        }

        const imageUrl = item.trim();
        if (!imageUrl) {
            continue;
        }

        const urlError = validateHostedImageUrl(imageUrl);
        if (urlError && !allowedExistingImageUrls.has(imageUrl)) {
            throw new Error('Slike moraju biti učitane kroz Gredice.');
        }

        uniqueUrls.add(imageUrl);
    }

    if (uniqueUrls.size > MAX_COMPLETION_IMAGE_COUNT) {
        throw new Error(
            `Zapis završetka može imati najviše ${MAX_COMPLETION_IMAGE_COUNT} slika.`,
        );
    }

    return Array.from(uniqueUrls);
}

function buildRaisedBedNotificationLink(
    raisedBedName: string | null | undefined,
    positionIndex: number | null | undefined,
) {
    if (!raisedBedName) {
        return undefined;
    }

    return getRaisedBedCloseupUrl(
        raisedBedName,
        typeof positionIndex === 'number' ? { positionIndex } : undefined,
    );
}

async function assertRaisedBedAllowsNewOperation(raisedBedId?: number) {
    if (!raisedBedId) {
        return;
    }

    const raisedBed = await getRaisedBed(raisedBedId);
    if (raisedBed && isRaisedBedAbandoned(raisedBed.status)) {
        throw new Error(
            `${RAISED_BED_ABANDONED_DUE_TO_INACTIVITY_MESSAGE} ${RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE}`,
        );
    }
}

async function assertRaisedBedTargetsAllowNewOperations(
    targets: ParsedOperationTarget[],
) {
    const raisedBedIds = Array.from(
        new Set(
            targets
                .map((target) => target.raisedBedId)
                .filter(
                    (raisedBedId): raisedBedId is number =>
                        raisedBedId !== undefined,
                ),
        ),
    );

    await Promise.all(raisedBedIds.map(assertRaisedBedAllowsNewOperation));
}

export async function createOperationAction(formData: FormData) {
    await auth(['admin']);
    const entityId = formData.get('entityId')
        ? Number(formData.get('entityId'))
        : undefined;
    if (!entityId) {
        throw new Error('Entity ID is required');
    }
    const accountId = formData.get('accountId') as string;
    if (!accountId) {
        throw new Error('Account ID is required');
    }

    const scheduledDate = formData.get('scheduledDate')
        ? new Date(formData.get('scheduledDate') as string)
        : undefined;

    const operation: InsertOperation = {
        entityId,
        entityTypeName: formData.get('entityTypeName') as string,
        accountId,
        farmId: formData.get('farmId')
            ? Number(formData.get('farmId'))
            : undefined,
        gardenId: formData.get('gardenId')
            ? Number(formData.get('gardenId'))
            : undefined,
        raisedBedId: formData.get('raisedBedId')
            ? Number(formData.get('raisedBedId'))
            : undefined,
        raisedBedFieldId: formData.get('raisedBedFieldId')
            ? Number(formData.get('raisedBedFieldId'))
            : undefined,
        timestamp: formData.get('timestamp')
            ? new Date(formData.get('timestamp') as string)
            : undefined,
    };
    await assertRaisedBedAllowsNewOperation(operation.raisedBedId ?? undefined);
    const operationId = await createOperation(operation);
    if (scheduledDate) {
        await createEvent(
            knownEvents.operations.scheduledV1(operationId.toString(), {
                scheduledDate: scheduledDate.toISOString(),
            }),
        );
        await notifyOperationUpdate(operationId, 'scheduled', {
            scheduledDate: scheduledDate.toISOString(),
        });
    }
    revalidatePath(KnownPages.Schedule);
    if (operation.accountId)
        revalidatePath(KnownPages.Account(operation.accountId));
    if (operation.farmId) revalidatePath(KnownPages.Farm(operation.farmId));
    if (operation.gardenId)
        revalidatePath(KnownPages.Garden(operation.gardenId));
    if (operation.raisedBedId)
        revalidatePath(KnownPages.RaisedBed(operation.raisedBedId));
    revalidatePath(KnownPages.Operations);
    revalidatePath(KnownPages.Operation(operationId));
    return { success: true };
}

export type SingleCreateOperationActionState = {
    success: boolean;
    message: string;
};

type ParsedOperationTarget = {
    accountId?: string;
    farmId?: number;
    gardenId?: number;
    raisedBedId?: number;
    raisedBedFieldId?: number;
};

function getStringFormValue(formData: FormData, name: string) {
    const value = formData.get(name);
    return typeof value === 'string' ? value.trim() : '';
}

function parseOptionalTargetId(value: string | undefined, label: string) {
    if (!value) {
        return undefined;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`Neispravna ciljna lokacija: ${label}.`);
    }

    return parsed;
}

function parseOperationTarget(rawTarget: string): ParsedOperationTarget {
    const target = rawTarget.trim();
    if (!target) {
        throw new Error('Odaberite ciljnu lokaciju.');
    }

    const parts = target.split('|');
    if (parts[0] === 'farm') {
        const farmId = parseOptionalTargetId(parts[1], 'farma');
        if (!farmId) {
            throw new Error('Odaberite farmu.');
        }

        return { farmId };
    }

    const [accountId, gardenId, raisedBedId, raisedBedFieldId] = parts;

    return {
        accountId: accountId || undefined,
        gardenId: parseOptionalTargetId(gardenId, 'vrt'),
        raisedBedId: parseOptionalTargetId(raisedBedId, 'gredica'),
        raisedBedFieldId: parseOptionalTargetId(
            raisedBedFieldId,
            'polje gredice',
        ),
    };
}

export async function singleCreateOperationAction(
    _previousState: SingleCreateOperationActionState | null,
    formData: FormData,
): Promise<SingleCreateOperationActionState> {
    try {
        const { userId } = await auth(['admin']);
        const entityId = formData.get('entityId')
            ? Number(formData.get('entityId'))
            : undefined;
        if (!entityId) {
            throw new Error('Entity ID is required');
        }
        const target = getStringFormValue(formData, 'target');
        if (!target) {
            throw new Error('Odaberite jednu ciljnu lokaciju.');
        }
        const selectedAssignedUserId =
            getStringFormValue(formData, 'assignedUserId') || undefined;
        const scheduledDate = formData.get('scheduledDate')
            ? new Date(formData.get('scheduledDate') as string)
            : undefined;

        const parsedTarget = parseOperationTarget(target);
        await assertRaisedBedAllowsNewOperation(parsedTarget.raisedBedId);

        if (selectedAssignedUserId && parsedTarget.farmId) {
            const assignableFarmUsersByFarmId =
                await getAssignableFarmUsersByFarmIds([parsedTarget.farmId]);
            const isUserAssignableToFarm =
                assignableFarmUsersByFarmId[parsedTarget.farmId]?.some(
                    (user) => user.id === selectedAssignedUserId,
                ) ?? false;
            if (!isUserAssignableToFarm) {
                throw new Error(
                    'Odabrani korisnik nije dostupan za odabranu radnju.',
                );
            }
        } else if (selectedAssignedUserId && parsedTarget.gardenId) {
            const assignableFarmUsersByGardenId =
                await getAssignableFarmUsersByGardenIds([
                    parsedTarget.gardenId,
                ]);
            const isUserAssignableToGarden =
                assignableFarmUsersByGardenId[parsedTarget.gardenId]?.some(
                    (user) => user.id === selectedAssignedUserId,
                ) ?? false;
            if (!isUserAssignableToGarden) {
                throw new Error(
                    'Odabrani korisnik nije dostupan za odabranu radnju.',
                );
            }
        }

        const operationId = await createOperation({
            entityId,
            entityTypeName: 'operation',
            accountId: parsedTarget.accountId,
            farmId: parsedTarget.farmId,
            gardenId: parsedTarget.gardenId,
            raisedBedId: parsedTarget.raisedBedId,
            raisedBedFieldId: parsedTarget.raisedBedFieldId,
            timestamp: undefined,
        });

        if (scheduledDate) {
            await createEvent(
                knownEvents.operations.scheduledV1(operationId.toString(), {
                    scheduledDate: scheduledDate.toISOString(),
                }),
            );
            await notifyOperationUpdate(operationId, 'scheduled', {
                scheduledDate: scheduledDate.toISOString(),
            });
        }
        if (selectedAssignedUserId) {
            await createEvent(
                knownEvents.operations.assignedV1(operationId.toString(), {
                    assignedUserId: selectedAssignedUserId,
                    assignedBy: userId,
                }),
            );
            await notifyOperationAssignedUsers(operationId, [
                selectedAssignedUserId,
            ]);
        }

        revalidatePath(KnownPages.Schedule);
        revalidatePath(KnownPages.Operations);
        if (parsedTarget.farmId) {
            revalidatePath(KnownPages.Farm(parsedTarget.farmId));
        }

        return { success: true, message: 'Radnja je uspješno kreirana.' };
    } catch (error) {
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : 'Došlo je do greške pri kreiranju radnje.',
        };
    }
}
export type BulkCreateOperationsActionState = {
    success: boolean;
    message: string;
    createdCount?: number;
    totalCount?: number;
};

export async function bulkCreateOperationsAction(
    _previousState: BulkCreateOperationsActionState | null,
    formData: FormData,
): Promise<BulkCreateOperationsActionState> {
    try {
        const { userId } = await auth(['admin']);
        const entityId = formData.get('entityId')
            ? Number(formData.get('entityId'))
            : undefined;
        if (!entityId) {
            throw new Error('Entity ID is required');
        }
        const scheduledDate = formData.get('scheduledDate')
            ? new Date(formData.get('scheduledDate') as string)
            : undefined;
        const selectedAssignedUserId =
            getStringFormValue(formData, 'assignedUserId') || undefined;
        const approveOnCreate =
            getStringFormValue(formData, 'approve') === 'true';
        const targets = formData
            .getAll('targets')
            .filter((value): value is string => typeof value === 'string');
        if (targets.length === 0) {
            throw new Error('Odaberite barem jednu ciljnu lokaciju.');
        }
        if (approveOnCreate && !selectedAssignedUserId) {
            throw new Error(
                'Radnje ne mogu biti potvrđene prije nego što korisnik bude dodijeljen.',
            );
        }
        const parsedTargets = targets.map(parseOperationTarget);
        await assertRaisedBedTargetsAllowNewOperations(parsedTargets);

        if (selectedAssignedUserId) {
            const uniqueFarmIds = Array.from(
                new Set(
                    parsedTargets
                        .map((target) => target.farmId)
                        .filter(
                            (farmId): farmId is number => farmId !== undefined,
                        ),
                ),
            );
            const uniqueGardenIds = Array.from(
                new Set(
                    parsedTargets
                        .map((target) => target.gardenId)
                        .filter(
                            (gardenId): gardenId is number =>
                                gardenId !== undefined,
                        ),
                ),
            );
            const [assignableFarmUsersByFarmId, assignableFarmUsersByGardenId] =
                await Promise.all([
                    getAssignableFarmUsersByFarmIds(uniqueFarmIds),
                    getAssignableFarmUsersByGardenIds(uniqueGardenIds),
                ]);
            for (const farmId of uniqueFarmIds) {
                const isUserAssignableToFarm =
                    assignableFarmUsersByFarmId[farmId]?.some(
                        (user) => user.id === selectedAssignedUserId,
                    ) ?? false;
                if (!isUserAssignableToFarm) {
                    throw new Error(
                        'Odabrani korisnik nije dostupan za sve odabrane radnje.',
                    );
                }
            }
            for (const gardenId of uniqueGardenIds) {
                const isUserAssignableToGarden =
                    assignableFarmUsersByGardenId[gardenId]?.some(
                        (user) => user.id === selectedAssignedUserId,
                    ) ?? false;
                if (!isUserAssignableToGarden) {
                    throw new Error(
                        'Odabrani korisnik nije dostupan za sve odabrane radnje.',
                    );
                }
            }
        }

        let createdCount = 0;
        for (const parsedTarget of parsedTargets) {
            const operation: InsertOperation = {
                entityId,
                entityTypeName: 'operation',
                accountId: parsedTarget.accountId,
                farmId: parsedTarget.farmId,
                gardenId: parsedTarget.gardenId,
                raisedBedId: parsedTarget.raisedBedId,
                raisedBedFieldId: parsedTarget.raisedBedFieldId,
                timestamp: undefined,
            };
            const operationId = await createOperation(operation);
            if (scheduledDate) {
                await createEvent(
                    knownEvents.operations.scheduledV1(operationId.toString(), {
                        scheduledDate: scheduledDate.toISOString(),
                    }),
                );
                await notifyOperationUpdate(operationId, 'scheduled', {
                    scheduledDate: scheduledDate.toISOString(),
                });
            }
            if (selectedAssignedUserId) {
                await createEvent(
                    knownEvents.operations.assignedV1(operationId.toString(), {
                        assignedUserId: selectedAssignedUserId,
                        assignedBy: userId,
                    }),
                );
                await notifyOperationAssignedUsers(operationId, [
                    selectedAssignedUserId,
                ]);
            }
            if (approveOnCreate) {
                await acceptOperation(operationId);
                await notifyOperationUpdate(operationId, 'approved');
            }
            createdCount += 1;
        }

        revalidatePath(KnownPages.Schedule);
        revalidatePath(KnownPages.Operations);
        for (const farmId of new Set(
            parsedTargets
                .map((target) => target.farmId)
                .filter((farmId): farmId is number => farmId !== undefined),
        )) {
            revalidatePath(KnownPages.Farm(farmId));
        }

        return {
            success: true,
            message: `Uspješno kreirano ${createdCount} radnji.`,
            createdCount,
            totalCount: targets.length,
        };
    } catch (error) {
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : 'Došlo je do greške pri kreiranju radnji.',
        };
    }
}

export type SwitchOperationEntityActionState = {
    success: boolean;
    message: string;
};

function parseRequiredPositiveInteger(
    formData: FormData,
    name: string,
    message: string,
) {
    const value = formData.get(name);
    const parsed = typeof value === 'string' ? Number(value) : NaN;

    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(message);
    }

    return parsed;
}

function parseRequiredTaskVersionEventId(formData: FormData) {
    const value = formData.get('expectedTaskVersionEventId');
    const parsed = typeof value === 'string' ? Number(value) : NaN;

    if (!Number.isSafeInteger(parsed) || parsed < 0) {
        throw new Error('Trenutna verzija radnje nije ispravna.');
    }

    return parsed;
}

function assertTaskVersionEventId(value: number) {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error('Trenutna verzija radnje nije ispravna.');
    }

    return value;
}

export async function switchOperationEntityAction(
    _previousState: SwitchOperationEntityActionState | null,
    formData: FormData,
): Promise<SwitchOperationEntityActionState> {
    try {
        await auth(['admin']);

        const operationId = parseRequiredPositiveInteger(
            formData,
            'operationId',
            'Operation ID is required.',
        );
        const entityId = parseRequiredPositiveInteger(
            formData,
            'entityId',
            'Odaberite novu radnju.',
        );
        const expectedEntityId = parseRequiredPositiveInteger(
            formData,
            'expectedEntityId',
            'Trenutna radnja nije ispravna.',
        );
        const expectedTaskVersionEventId =
            parseRequiredTaskVersionEventId(formData);

        const availableOperations =
            await getEntitiesFormatted<EntityStandardized>('operation');
        const replacementOperation = availableOperations.find(
            (candidate) => candidate.id === entityId,
        );

        if (!replacementOperation) {
            throw new Error('Odabrana radnja nije dostupna.');
        }

        const mutation = await withOperationScheduleTaskTransaction(
            operationId,
            async (transaction) => {
                const operation = await getOperationById(
                    operationId,
                    transaction,
                );
                if (
                    operation.entityId !== expectedEntityId ||
                    operation.taskVersionEventId !==
                        expectedTaskVersionEventId ||
                    operation.entityTypeName !== 'operation'
                ) {
                    throw new Error(
                        'Radnja se u međuvremenu promijenila. Osvježi stranicu i pokušaj ponovno.',
                    );
                }
                if (!canSwitchOperationTaskEntity(operation.status)) {
                    throw new Error(
                        'Radnja se više ne može promijeniti nakon završetka ili prijave prepreke.',
                    );
                }
                if (operation.entityId === entityId) {
                    return { changed: false, operation };
                }
                if (
                    !operationDefinitionMatchesTargetScope(
                        operation,
                        replacementOperation,
                    )
                ) {
                    throw new Error(
                        'Odabrana radnja nije kompatibilna s lokacijom postojeće radnje.',
                    );
                }

                await switchOperationEntity(
                    operationId,
                    {
                        entityId,
                        entityTypeName: 'operation',
                    },
                    transaction,
                );
                return { changed: true, operation };
            },
        );
        await revalidateOperationPaths(mutation.operation);

        if (!mutation.changed) {
            return {
                success: true,
                message: 'Odabrana radnja je već postavljena.',
            };
        }

        return { success: true, message: 'Radnja je promijenjena.' };
    } catch (error) {
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : 'Došlo je do greške pri promjeni radnje.',
        };
    }
}

export async function rescheduleOperationAction(formData: FormData) {
    await auth(['admin']);
    const operationId = formData.get('operationId')
        ? Number(formData.get('operationId'))
        : undefined;
    if (!operationId) {
        throw new Error('Operation ID is required');
    }
    const expectedEntityId = formData.get('expectedEntityId')
        ? Number(formData.get('expectedEntityId'))
        : undefined;
    if (!expectedEntityId) {
        throw new Error('Expected operation entity ID is required');
    }
    const expectedTaskVersionEventId =
        parseRequiredTaskVersionEventId(formData);
    const scheduledDate = formData.get('scheduledDate') as string;
    if (!scheduledDate) {
        throw new Error('Scheduled Date is required');
    }

    const newDate = new Date(scheduledDate);
    const expectedOperation = await getOperationById(operationId);
    const operation = await withOperationScheduleTaskTransaction(
        operationId,
        async (transaction) => {
            const currentOperation = await getOperationById(
                operationId,
                transaction,
            );
            if (currentOperation.status !== expectedOperation.status) {
                throw new Error(
                    'Radnja se u međuvremenu promijenila. Osvježi stranicu i pokušaj ponovno.',
                );
            }
            if (
                currentOperation.entityId !== expectedEntityId ||
                currentOperation.entityId !== expectedOperation.entityId ||
                currentOperation.taskVersionEventId !==
                    expectedTaskVersionEventId
            ) {
                throw new Error(
                    'Radnja se u međuvremenu promijenila. Osvježi stranicu i pokušaj ponovno.',
                );
            }
            if (!canRescheduleOperationTask(currentOperation.status)) {
                throw new Error(
                    'Radnja se više ne može zakazati ili prerasporediti.',
                );
            }
            await createEvent(
                knownEvents.operations.scheduledV1(operationId.toString(), {
                    scheduledDate: newDate.toISOString(),
                }),
                transaction,
            );
            await unacceptOperation(operationId, transaction);
            return currentOperation;
        },
    );

    await notifyOperationUpdate(operationId, 'rescheduled', {
        scheduledDate: newDate.toISOString(),
    });

    await revalidateOperationPaths(operation);
    return { success: true };
}

export async function acceptOperationAction(
    operationId: number,
    expectedEntityId: number,
    expectedTaskVersionEventId: number,
) {
    await auth(['admin']);
    const validExpectedTaskVersionEventId = assertTaskVersionEventId(
        expectedTaskVersionEventId,
    );
    const expectedOperation = await getOperationById(operationId);
    const operation = await withOperationScheduleTaskTransaction(
        operationId,
        async (transaction) => {
            const currentOperation = await getOperationById(
                operationId,
                transaction,
            );
            if (
                currentOperation.status !== expectedOperation.status ||
                currentOperation.entityId !== expectedEntityId ||
                currentOperation.entityId !== expectedOperation.entityId ||
                currentOperation.taskVersionEventId !==
                    validExpectedTaskVersionEventId ||
                currentOperation.assignedUserId !==
                    expectedOperation.assignedUserId
            ) {
                throw new Error(
                    'Radnja se u međuvremenu promijenila. Osvježi stranicu i pokušaj ponovno.',
                );
            }
            if (!currentOperation.assignedUserId) {
                throw new Error(
                    'Radnja ne može biti potvrđena prije nego što korisnik bude dodijeljen.',
                );
            }
            if (!canAcceptOperationTask(currentOperation.status)) {
                throw new Error(
                    'Radnja se više ne može potvrditi nakon završetka, otkazivanja ili prijave prepreke.',
                );
            }
            await acceptOperation(operationId, transaction);
            return currentOperation;
        },
    );
    await notifyOperationUpdate(operationId, 'approved');
    await revalidateOperationPaths(operation);
}

export async function unacceptOperationAction(
    operationId: number,
    expectedEntityId: number,
    expectedTaskVersionEventId: number,
) {
    await auth(['admin']);
    const validExpectedTaskVersionEventId = assertTaskVersionEventId(
        expectedTaskVersionEventId,
    );
    const expectedOperation = await getOperationById(operationId);
    const mutation = await withOperationScheduleTaskTransaction(
        operationId,
        async (transaction) => {
            const operation = await getOperationById(operationId, transaction);
            if (
                operation.status !== expectedOperation.status ||
                operation.entityId !== expectedEntityId ||
                operation.entityId !== expectedOperation.entityId ||
                operation.taskVersionEventId !== validExpectedTaskVersionEventId
            ) {
                throw new Error(
                    'Radnja se u međuvremenu promijenila. Osvježi stranicu i pokušaj ponovno.',
                );
            }
            if (!operation.isAccepted) {
                return { changed: false, operation };
            }
            if (!canUnacceptOperationTask(operation.status)) {
                throw new Error(
                    'Potvrda se više ne može poništiti nakon završetka ili prijave prepreke.',
                );
            }

            await unacceptOperation(operationId, transaction);
            return { changed: true, operation };
        },
    );
    if (!mutation.changed) {
        return { success: true };
    }

    const { operation } = mutation;
    await revalidateOperationPaths(operation);

    return { success: true };
}

export async function assignOperationUserAction(
    operationId: number,
    expectedEntityId: number,
    expectedTaskVersionEventId: number,
    assignedUserIds: string[],
) {
    const { userId } = await auth(['admin']);
    const operation = await getOperationById(operationId);
    if (!operation) {
        throw new Error(`Operation with ID ${operationId} not found.`);
    }

    const assignment = await assignOperationTaskUsers({
        assignedBy: userId,
        assignedUserIds,
        expectedEntityId,
        expectedTaskVersionEventId: assertTaskVersionEventId(
            expectedTaskVersionEventId,
        ),
        operationId,
    });
    if (!assignment.changed) {
        return { success: true };
    }

    if (assignment.newlyAssignedUserIds.length > 0) {
        await notifyOperationAssignedUsers(
            operationId,
            assignment.newlyAssignedUserIds,
        );
    }

    await revalidateOperationPaths(operation);

    return { success: true };
}

async function revalidateOperationPaths(
    operation: Awaited<ReturnType<typeof getOperationById>>,
) {
    revalidatePath(KnownPages.Schedule);
    revalidatePath(KnownPages.Operations);
    revalidatePath(KnownPages.Approvals);
    revalidatePath(KnownPages.Operation(operation.id));
    if (operation.accountId)
        revalidatePath(KnownPages.Account(operation.accountId));
    if (operation.farmId) revalidatePath(KnownPages.Farm(operation.farmId));
    if (operation.gardenId)
        revalidatePath(KnownPages.Garden(operation.gardenId));
    if (operation.raisedBedId)
        revalidatePath(KnownPages.RaisedBed(operation.raisedBedId));
}

async function buildOperationCompletionNotification(
    operation: Awaited<ReturnType<typeof getOperationById>>,
) {
    const operationData = await getEntityFormatted<EntityStandardized>(
        operation.entityId,
    );

    const header = `${operationData?.information?.label}`;
    let content = `Danas je određeno **${operationData?.information?.label}**.`;
    let linkUrl: string | undefined;
    if (operation.raisedBedId) {
        const raisedBed = await getRaisedBed(operation.raisedBedId);
        if (!raisedBed) {
            console.error(
                `Raised bed with ID ${operation.raisedBedId} not found.`,
            );
        } else {
            const positionIndex = operation.raisedBedFieldId
                ? raisedBed.fields.find(
                      (field) => field.id === operation.raisedBedFieldId,
                  )?.positionIndex
                : null;
            linkUrl = buildRaisedBedNotificationLink(
                raisedBed.name,
                positionIndex,
            );
            if (typeof positionIndex === 'number') {
                content = `Danas je na gredici **${raisedBed.name}** za polje **${positionIndex + 1}** odrađeno **${operationData?.information?.label}**.`;
            } else {
                content = `Danas je na gredici **${raisedBed.name}** odrađeno **${operationData?.information?.label}**.`;
            }
        }
    }

    return {
        header,
        content,
        linkUrl,
    };
}

async function notifyVerifiedOperationCompletion(
    operation: Awaited<ReturnType<typeof getOperationById>>,
    { notifySlack }: { notifySlack: boolean },
) {
    const { header, content, linkUrl } =
        await buildOperationCompletionNotification(operation);
    if (!operation.completedBy) {
        throw new Error('Completed operation is missing a completion actor.');
    }
    if (!operation.verificationEventId || !operation.verifiedAt) {
        throw new Error('Completed operation is missing a verification event.');
    }

    await Promise.all([
        notifySlack
            ? notifyOperationUpdate(operation.id, 'completed', {
                  completedBy: operation.completedBy,
              })
            : undefined,
        operation.accountId
            ? createNotification(
                  {
                      accountId: operation.accountId,
                      gardenId: operation.gardenId,
                      raisedBedId: operation.raisedBedId,
                      header,
                      content,
                      imageUrl: operation.imageUrls?.[0],
                      linkUrl,
                      timestamp: operation.verifiedAt,
                  },
                  {
                      idempotencyKey: `schedule-task:operation-completed:${operation.verificationEventId.toString()}`,
                  },
              )
            : undefined,
    ]);
}

async function verifyOperationCompletion(
    operationId: number,
    verifiedBy: string,
    expectedTaskVersionEventId: number,
) {
    const result = await verifyOperationTaskCompletion({
        expectedTaskVersionEventId: assertTaskVersionEventId(
            expectedTaskVersionEventId,
        ),
        operationId,
        verifiedBy,
    });

    const verifiedOperation = await getOperationById(operationId);
    await notifyVerifiedOperationCompletion(verifiedOperation, {
        notifySlack: result.created,
    });
    await revalidateOperationPaths(verifiedOperation);

    return { success: true };
}

export async function completeOperation(
    operationId: number,
    expectedEntityId: number,
    expectedTaskVersionEventId: number,
    imageUrls?: string[],
    notes?: string,
) {
    const {
        user: { role },
        userId,
    } = await auth(['admin', 'farmer']);
    const completionNotes = normalizeCompletionNotes(notes);
    const operation = await getOperationById(operationId);
    if (!operation) {
        throw new Error(`Operation with ID ${operationId} not found.`);
    }
    if (!operation.isAccepted) {
        throw new Error('Operation must be accepted before completion');
    }

    const result = await submitOperationTaskCompletion({
        actor: {
            role: role === 'admin' ? 'admin' : 'farmer',
            userId,
        },
        imageUrls,
        notes: completionNotes,
        operationId,
        expectedEntityId,
        expectedTaskVersionEventId: assertTaskVersionEventId(
            expectedTaskVersionEventId,
        ),
    });
    if (result.status === 'completed') {
        const verifiedOperation = await getOperationById(operationId);
        await notifyVerifiedOperationCompletion(verifiedOperation, {
            notifySlack: result.created,
        });
    }

    await revalidateOperationPaths(operation);

    return { success: true };
}

export async function completeOperationWithImageUrls(
    operationId: number,
    expectedEntityId: number,
    expectedTaskVersionEventId: number,
    imageUrls: string[],
    notes?: string,
) {
    if (!operationId) {
        throw new Error('Operation ID is required');
    }
    return completeOperation(
        operationId,
        expectedEntityId,
        expectedTaskVersionEventId,
        imageUrls,
        notes,
    );
}

export async function updateOperationCompletionEvidenceAction(
    operationId: number,
    expectedTaskVersionEventId: number,
    imageUrls: unknown,
    notes?: string,
) {
    const { userId } = await auth(['admin']);
    const operation = await getOperationById(operationId);
    await updateOperationCompletionEvidence({
        expectedTaskVersionEventId: assertTaskVersionEventId(
            expectedTaskVersionEventId,
        ),
        imageUrls: normalizeCompletionImageUrls(
            imageUrls,
            operation.imageUrls ?? [],
        ),
        notes: normalizeCompletionNotes(notes) ?? '',
        operationId,
        updatedBy: userId,
    });

    const updatedOperation = await getOperationById(operationId);
    await revalidateOperationPaths(updatedOperation);

    return { success: true };
}

export async function verifyOperationAction(
    operationId: number,
    expectedTaskVersionEventId: number,
) {
    const { userId } = await auth(['admin']);
    return verifyOperationCompletion(
        operationId,
        userId,
        expectedTaskVersionEventId,
    );
}

export async function cancelOperationAction(formData: FormData) {
    const { userId } = await auth(['admin']);
    const operationId = formData.get('operationId')
        ? Number(formData.get('operationId'))
        : undefined;
    if (!operationId) {
        throw new Error('Operation ID is required');
    }
    const expectedEntityId = formData.get('expectedEntityId')
        ? Number(formData.get('expectedEntityId'))
        : undefined;
    if (!expectedEntityId) {
        throw new Error('Expected operation entity ID is required');
    }
    const expectedTaskVersionEventId =
        parseRequiredTaskVersionEventId(formData);
    const reason = formData.get('reason') as string;
    if (!reason || reason.trim().length === 0) {
        throw new Error('Cancellation reason is required');
    }

    const refundEntries = formData.getAll('shouldRefund');
    const notifyEntries = formData.getAll('shouldNotify');
    const shouldRefund =
        refundEntries.length === 0 || refundEntries.includes('true');
    const shouldNotify =
        notifyEntries.length === 0 || notifyEntries.includes('true');

    const operation = await getOperationById(operationId);
    if (!operation) {
        throw new Error(`Operation with ID ${operationId} not found.`);
    }

    // Get operation details for notification and refund calculation
    const operationData = await getEntityFormatted<EntityStandardized>(
        operation.entityId,
    );
    let linkUrl: string | undefined;

    // Calculate refund amount (operation price in sunflowers - multiplied by 1000 as per checkout logic)
    const refundAmount = operationData?.prices?.perOperation
        ? Math.round(operationData.prices.perOperation * 1000)
        : 0;

    const header = 'Radnja je otkazana';
    let content = `Radnja **${operationData?.information?.label}** je otkazana.`;
    if (operation.raisedBedId) {
        const raisedBed = await getRaisedBed(operation.raisedBedId);
        if (!raisedBed) {
            console.error(
                `Raised bed with ID ${operation.raisedBedId} not found.`,
            );
        } else {
            const positionIndex = operation.raisedBedFieldId
                ? raisedBed.fields.find(
                      (f) => f.id === operation.raisedBedFieldId,
                  )?.positionIndex
                : null;
            if (typeof positionIndex === 'number') {
                content = `Radnja **${operationData?.information?.label}** na gredici **${raisedBed.name}** za polje **${positionIndex + 1}** je otkazana.`;
            } else {
                content = `Radnja **${operationData?.information?.label}** na gredici **${raisedBed.name}** je otkazana.`;
            }
            linkUrl = buildRaisedBedNotificationLink(
                raisedBed.name,
                positionIndex,
            );
        }
    }

    const cancellation = await cancelOperationTaskWithRefund({
        canceledBy: userId,
        expectedEntityId,
        expectedStatus: operation.status,
        expectedTaskVersionEventId,
        notificationRequested: shouldNotify,
        operationId,
        operatorNotificationRequested: shouldNotify,
        reason,
        refundAmount: shouldRefund ? refundAmount : 0,
    });

    if (cancellation.reason) {
        content += `\nRazlog otkazivanja: ${cancellation.reason}`;
    }
    if (cancellation.refundAmount > 0) {
        content += `\nSredstva su ti vraćena u iznosu od ${cancellation.refundAmount} 🌻.`;
    }

    if (
        cancellation.notificationRequested &&
        cancellation.operation.accountId
    ) {
        const notificationId = await createNotification(
            {
                accountId: cancellation.operation.accountId,
                gardenId: cancellation.operation.gardenId,
                raisedBedId: cancellation.operation.raisedBedId,
                header,
                content,
                linkUrl,
                timestamp: cancellation.canceledAt,
            },
            {
                idempotencyKey: `admin:operation-canceled:${cancellation.cancellationEventId.toString()}`,
            },
        );

        if (cancellation.operatorNotificationRequested) {
            const delivery = await deliverNotificationOperatorAlert(
                notificationId,
                () =>
                    notifyOperationUpdate(operationId, 'canceled', {
                        reason: cancellation.reason,
                        canceledBy: cancellation.canceledBy,
                    }),
            );
            if (delivery.status === 'failed') {
                throw delivery.error;
            }
        }
    }

    await revalidateOperationPaths(cancellation.operation);
    return { success: true };
}
