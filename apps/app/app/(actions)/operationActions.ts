'use server';

import { getRaisedBedCloseupUrl } from '@gredice/js/urls';
import { notifyOperationUpdate } from '@gredice/notifications';
import {
    acceptOperation,
    createEvent,
    createNotification,
    createOperation,
    earnSunflowers,
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
    if (operation.gardenId)
        revalidatePath(KnownPages.Garden(operation.gardenId));
    if (operation.raisedBedId)
        revalidatePath(KnownPages.RaisedBed(operation.raisedBedId));
    return { success: true };
}

export async function bulkCreateOperationsAction(formData: FormData) {
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
        (formData.get('assignedUserId') as string | null)?.trim() || undefined;
    const targets = formData.getAll('targets') as string[];

    if (selectedAssignedUserId) {
        const uniqueGardenIds = Array.from(
            new Set(
                targets
                    .map((target) => target.split('|')[1])
                    .filter((gardenId) => gardenId)
                    .map((gardenId) => Number(gardenId))
                    .filter((gardenId) => !Number.isNaN(gardenId)),
            ),
        );
        const assignableFarmUsersByGardenId =
            await getAssignableFarmUsersByGardenIds(uniqueGardenIds);
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

    for (const target of targets) {
        const [accountId, gardenId, raisedBedId, raisedBedFieldId] =
            target.split('|');
        const operation: InsertOperation = {
            entityId,
            entityTypeName: 'operation',
            accountId: accountId || undefined,
            gardenId: gardenId ? Number(gardenId) : undefined,
            raisedBedId: raisedBedId ? Number(raisedBedId) : undefined,
            raisedBedFieldId: raisedBedFieldId
                ? Number(raisedBedFieldId)
                : undefined,
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
        }
    }
    revalidatePath(KnownPages.Schedule);
    revalidatePath(KnownPages.Operations);
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
    assignedUserId: string | null,
) {
    const { userId } = await auth(['admin']);
    const operation = await getOperationById(operationId);
    if (!operation) {
        throw new Error(`Operation with ID ${operationId} not found.`);
    }

    const normalizedAssignedUserId = assignedUserId?.trim() || null;
    if (operation.assignedUserId === normalizedAssignedUserId) {
        return { success: true };
    }

    if (normalizedAssignedUserId) {
        const assignableFarmUsersByOperationId =
            await getAssignableFarmUsersByOperationIds([operationId]);
        const assignableFarmUsers =
            assignableFarmUsersByOperationId[operationId] ?? [];

        if (
            !assignableFarmUsers.some(
                (farmUser) => farmUser.id === normalizedAssignedUserId,
            )
        ) {
            throw new Error('Odabrani korisnik nije dostupan za ovu radnju.');
        }
    }

    await createEvent(
        knownEvents.operations.assignedV1(operationId.toString(), {
            assignedUserId: normalizedAssignedUserId,
            assignedBy: userId,
        }),
    );

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
        farmOperation.assignedUserId &&
        farmOperation.assignedUserId !== userId
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
) {
    const {
        user: { role },
        userId,
    } = await auth(['admin', 'farmer']);
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
) {
    if (!operationId) {
        throw new Error('Operation ID is required');
    }
    return completeOperation(operationId, imageUrls);
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
