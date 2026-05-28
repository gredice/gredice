'use server';

import {
    isRaisedBedAbandoned,
    RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE,
    RAISED_BED_ABANDONED_DUE_TO_INACTIVITY_MESSAGE,
} from '@gredice/js/raisedBeds';
import { getRaisedBedCloseupUrl } from '@gredice/js/urls';
import {
    notifyOperationAssignedUsers,
    notifyOperationUpdate,
} from '@gredice/notifications';
import {
    acceptOperation,
    createEvent,
    createNotification,
    createOperation,
    earnSunflowers,
    getAssignableFarmUsersByFarmIds,
    getAssignableFarmUsersByGardenIds,
    getAssignableFarmUsersByOperationIds,
    getEntityFormatted,
    getFarmUserAcceptedOperationById,
    getOperationById,
    getRaisedBed,
    type InsertOperation,
    knownEvents,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import type { EntityStandardized } from '../../lib/@types/EntityStandardized';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';

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
    await assertRaisedBedAllowsNewOperation(operation.raisedBedId);
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
        const targets = formData
            .getAll('targets')
            .filter((value): value is string => typeof value === 'string');
        if (targets.length === 0) {
            throw new Error('Odaberite barem jednu ciljnu lokaciju.');
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

export async function rescheduleOperationAction(formData: FormData) {
    await auth(['admin']);
    const operationId = formData.get('operationId')
        ? Number(formData.get('operationId'))
        : undefined;
    if (!operationId) {
        throw new Error('Operation ID is required');
    }
    const scheduledDate = formData.get('scheduledDate') as string;
    if (!scheduledDate) {
        throw new Error('Scheduled Date is required');
    }

    const operation = await getOperationById(operationId);
    if (!operation) {
        throw new Error(`Operation with ID ${operationId} not found.`);
    }

    // Create a new scheduled event to reschedule the operation
    const newDate = new Date(scheduledDate);
    await createEvent(
        knownEvents.operations.scheduledV1(operationId.toString(), {
            scheduledDate: newDate.toISOString(),
        }),
    );

    await notifyOperationUpdate(operationId, 'rescheduled', {
        scheduledDate: newDate.toISOString(),
    });

    revalidatePath(KnownPages.Schedule);
    if (operation.accountId)
        revalidatePath(KnownPages.Account(operation.accountId));
    if (operation.gardenId)
        revalidatePath(KnownPages.Garden(operation.gardenId));
    if (operation.raisedBedId)
        revalidatePath(KnownPages.RaisedBed(operation.raisedBedId));
    return { success: true };
}

export async function acceptOperationAction(operationId: number) {
    await auth(['admin']);
    const operation = await getOperationById(operationId);
    if (!operation) {
        throw new Error(`Operation with ID ${operationId} not found.`);
    }
    if (!operation.assignedUserId) {
        throw new Error(
            'Radnja ne može biti potvrđena prije nego što korisnik bude dodijeljen.',
        );
    }
    await acceptOperation(operationId);
    await notifyOperationUpdate(operationId, 'approved');
    revalidatePath(KnownPages.Schedule);
    if (operation.accountId)
        revalidatePath(KnownPages.Account(operation.accountId));
    if (operation.gardenId)
        revalidatePath(KnownPages.Garden(operation.gardenId));
    if (operation.raisedBedId)
        revalidatePath(KnownPages.RaisedBed(operation.raisedBedId));
}

export async function assignOperationUserAction(
    operationId: number,
    assignedUserIds: string[],
) {
    const { userId } = await auth(['admin']);
    const operation = await getOperationById(operationId);
    if (!operation) {
        throw new Error(`Operation with ID ${operationId} not found.`);
    }

    const normalizedAssignedUserIds = Array.from(
        new Set(
            assignedUserIds
                .map((assignedUserId) => assignedUserId.trim())
                .filter((assignedUserId) => assignedUserId.length > 0),
        ),
    );
    const operationAssignedUserIds = operation.assignedUserIds ?? [];
    if (
        normalizedAssignedUserIds.length === operationAssignedUserIds.length &&
        normalizedAssignedUserIds.every((assignedUserId) =>
            operationAssignedUserIds.includes(assignedUserId),
        )
    ) {
        return { success: true };
    }

    if (normalizedAssignedUserIds.length > 0) {
        const assignableFarmUsersByOperationId =
            await getAssignableFarmUsersByOperationIds([operationId]);
        const assignableFarmUsers =
            assignableFarmUsersByOperationId[operationId] ?? [];

        if (
            !normalizedAssignedUserIds.every((assignedUserId) =>
                assignableFarmUsers.some(
                    (farmUser) => farmUser.id === assignedUserId,
                ),
            )
        ) {
            throw new Error(
                'Jedan od odabranih korisnika nije dostupan za ovu radnju.',
            );
        }
    }

    await createEvent(
        knownEvents.operations.assignedV1(operationId.toString(), {
            assignedUserId: normalizedAssignedUserIds[0] ?? null,
            assignedUserIds: normalizedAssignedUserIds,
            assignedBy: userId,
        }),
    );

    const newlyAssignedUserIds = normalizedAssignedUserIds.filter(
        (assignedUserId) => !operationAssignedUserIds.includes(assignedUserId),
    );
    if (newlyAssignedUserIds.length > 0) {
        await notifyOperationAssignedUsers(operationId, newlyAssignedUserIds);
    }

    revalidatePath(KnownPages.Schedule);
    if (operation.accountId)
        revalidatePath(KnownPages.Account(operation.accountId));
    if (operation.gardenId)
        revalidatePath(KnownPages.Garden(operation.gardenId));
    if (operation.raisedBedId)
        revalidatePath(KnownPages.RaisedBed(operation.raisedBedId));

    return { success: true };
}

async function revalidateOperationPaths(
    operation: Awaited<ReturnType<typeof getOperationById>>,
) {
    revalidatePath(KnownPages.Schedule);
    revalidatePath(KnownPages.Operations);
    revalidatePath(KnownPages.Operation(operation.id));
    if (operation.accountId)
        revalidatePath(KnownPages.Account(operation.accountId));
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
            if (raisedBed.name) {
                linkUrl = getRaisedBedCloseupUrl(raisedBed.name);
            }

            const positionIndex = operation.raisedBedFieldId
                ? raisedBed.fields.find(
                      (field) => field.id === operation.raisedBedFieldId,
                  )?.positionIndex
                : null;
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
) {
    const { header, content, linkUrl } =
        await buildOperationCompletionNotification(operation);
    if (!operation.completedBy) {
        throw new Error('Completed operation is missing a completion actor.');
    }

    await Promise.all([
        notifyOperationUpdate(operation.id, 'completed', {
            completedBy: operation.completedBy,
        }),
        operation.accountId
            ? createNotification({
                  accountId: operation.accountId,
                  gardenId: operation.gardenId,
                  raisedBedId: operation.raisedBedId,
                  header,
                  content,
                  imageUrl: operation.imageUrls?.[0],
                  linkUrl,
                  timestamp: new Date(),
              })
            : undefined,
    ]);
}

async function assertFarmerCanCompleteOperation(
    userId: string,
    operation: Awaited<ReturnType<typeof getOperationById>>,
) {
    const farmOperation = await getFarmUserAcceptedOperationById(
        userId,
        operation.id,
    );
    if (!farmOperation) {
        throw new Error('Nemaš dozvolu za označavanje ove radnje.');
    }

    if (
        (farmOperation.assignedUserIds?.length ?? 0) > 0 &&
        !farmOperation.assignedUserIds?.includes(userId)
    ) {
        throw new Error('Ova radnja je dodijeljena drugom korisniku.');
    }
}

async function verifyOperationCompletion(
    operationId: number,
    verifiedBy: string,
) {
    const operation = await getOperationById(operationId);
    if (!operation) {
        throw new Error(`Operation with ID ${operationId} not found.`);
    }

    if (operation.status === 'completed') {
        return { success: true };
    }

    if (operation.status !== 'pendingVerification') {
        throw new Error('Radnja ne čeka verifikaciju.');
    }

    await createEvent(
        knownEvents.operations.verifiedV1(operationId.toString(), {
            verifiedBy,
        }),
    );

    const verifiedOperation = await getOperationById(operationId);
    await notifyVerifiedOperationCompletion(verifiedOperation);
    await revalidateOperationPaths(verifiedOperation);

    return { success: true };
}

export async function completeOperation(
    operationId: number,
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

    if (operation.status === 'completed') {
        return { success: true };
    }

    if (operation.status === 'pendingVerification') {
        if (role === 'admin') {
            return verifyOperationCompletion(operationId, userId);
        }

        throw new Error('Radnja već čeka verifikaciju.');
    }

    if (operation.status === 'failed' || operation.status === 'canceled') {
        throw new Error(
            `Cannot complete operation with status ${operation.status}`,
        );
    }

    if (role === 'farmer') {
        await assertFarmerCanCompleteOperation(userId, operation);
    }

    await createEvent(
        knownEvents.operations.completedV1(operationId.toString(), {
            completedBy: userId,
            images: imageUrls,
            notes: completionNotes,
        }),
    );

    if (role === 'admin') {
        await createEvent(
            knownEvents.operations.verifiedV1(operationId.toString(), {
                verifiedBy: userId,
            }),
        );

        const verifiedOperation = await getOperationById(operationId);
        await notifyVerifiedOperationCompletion(verifiedOperation);
    }

    await revalidateOperationPaths(operation);

    return { success: true };
}

export async function completeOperationWithImageUrls(
    operationId: number,
    imageUrls: string[],
    notes?: string,
) {
    if (!operationId) {
        throw new Error('Operation ID is required');
    }
    return completeOperation(operationId, imageUrls, notes);
}

export async function verifyOperationAction(operationId: number) {
    const { userId } = await auth(['admin']);
    return verifyOperationCompletion(operationId, userId);
}

export async function cancelOperationAction(formData: FormData) {
    const { userId } = await auth(['admin']);
    const operationId = formData.get('operationId')
        ? Number(formData.get('operationId'))
        : undefined;
    if (!operationId) {
        throw new Error('Operation ID is required');
    }
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

    // Only allow canceling new or planned operations
    if (
        operation.status === 'completed' ||
        operation.status === 'pendingVerification' ||
        operation.status === 'failed' ||
        operation.status === 'canceled'
    ) {
        throw new Error(
            `Cannot cancel operation with status ${operation.status}`,
        );
    }

    // Get operation details for notification and refund calculation
    const operationData = await getEntityFormatted<EntityStandardized>(
        operation.entityId,
    );

    // Calculate refund amount (operation price in sunflowers - multiplied by 1000 as per checkout logic)
    const refundAmount = operationData?.prices?.perOperation
        ? Math.round(operationData.prices.perOperation * 1000)
        : 0;

    const header = 'Radnje je otkazana';
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
        }
    }

    // Add reason
    if (reason) {
        content += `\nRazlog otkazivanja: ${reason}`;
    }

    // Add refund information
    if (shouldRefund && refundAmount > 0) {
        content += `\nSredstva su ti vraćana u iznosu od ${refundAmount} 🌻.`;
    }

    await createEvent(
        knownEvents.operations.canceledV1(operationId.toString(), {
            canceledBy: userId,
            reason,
        }),
    );

    await Promise.all([
        notifyOperationUpdate(operationId, 'canceled', {
            reason,
            canceledBy: userId,
        }),
        shouldRefund && refundAmount > 0 && operation.accountId
            ? earnSunflowers(
                  operation.accountId,
                  refundAmount,
                  `refund:operation:${operationId}`,
              )
            : Promise.resolve(),
        shouldNotify && operation.accountId
            ? createNotification({
                  accountId: operation.accountId,
                  gardenId: operation.gardenId,
                  raisedBedId: operation.raisedBedId,
                  header,
                  content,
                  timestamp: new Date(),
              })
            : undefined,
    ]);

    revalidatePath(KnownPages.Schedule);
    if (operation.accountId)
        revalidatePath(KnownPages.Account(operation.accountId));
    if (operation.gardenId)
        revalidatePath(KnownPages.Garden(operation.gardenId));
    if (operation.raisedBedId)
        revalidatePath(KnownPages.RaisedBed(operation.raisedBedId));
}
