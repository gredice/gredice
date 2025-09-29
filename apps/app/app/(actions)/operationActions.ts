'use server';

import { randomUUID } from 'node:crypto';
import {
    acceptOperation,
    cancelOperation,
    createEvent,
    createNotification,
    createOperation,
    getEntityFormatted,
    getOperationById,
    getRaisedBed,
    rescheduleOperation,
    type InsertOperation,
    knownEvents,
} from '@gredice/storage';
import { put } from '@vercel/blob';
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
    await Promise.all([
        scheduledDate &&
            createEvent(
                knownEvents.operations.scheduledV1(operationId.toString(), {
                    scheduledDate: scheduledDate.toISOString(),
                }),
            ),
    ]);
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
    await auth(['admin']);
    const entityId = formData.get('entityId')
        ? Number(formData.get('entityId'))
        : undefined;
    if (!entityId) {
        throw new Error('Entity ID is required');
    }
    const scheduledDate = formData.get('scheduledDate')
        ? new Date(formData.get('scheduledDate') as string)
        : undefined;
    const targets = formData.getAll('targets') as string[];

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

    const scheduledAt = new Date(scheduledDate);
    const operation = await rescheduleOperation(operationId, scheduledAt);

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
    revalidatePath(KnownPages.Schedule);
    if (operation.accountId)
        revalidatePath(KnownPages.Account(operation.accountId));
    if (operation.gardenId)
        revalidatePath(KnownPages.Garden(operation.gardenId));
    if (operation.raisedBedId)
        revalidatePath(KnownPages.RaisedBed(operation.raisedBedId));
}

export async function completeOperation(
    operationId: number,
    completedBy: string,
    imageUrls?: string[],
) {
    await auth(['admin']);
    const operation = await getOperationById(operationId);
    if (!operation) {
        throw new Error(`Operation with ID ${operationId} not found.`);
    }
    if (!operation.isAccepted) {
        throw new Error('Operation must be accepted before completion');
    }

    const operationData = await getEntityFormatted<EntityStandardized>(
        operation.entityId,
    );

    // TODO: Add operation icon
    const header = `${operationData?.information?.label}`;
    let content = `Danas je određeno **${operationData?.information?.label}**.`;
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
                content = `Danas je na gredici **${raisedBed.name}** za polje **${positionIndex + 1}** odrađeno **${operationData?.information?.label}**.`;
            } else {
                content = `Danas je na gredici **${raisedBed.name}** odrađeno **${operationData?.information?.label}**.`;
            }
        }
    }

    await Promise.all([
        createEvent(
            knownEvents.operations.completedV1(operationId.toString(), {
                completedBy,
                images: imageUrls,
            }),
        ),
        operation.accountId
            ? createNotification({
                  accountId: operation.accountId,
                  gardenId: operation.gardenId,
                  raisedBedId: operation.raisedBedId,
                  header,
                  content,
                  imageUrl: imageUrls?.[0],
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

export async function completeOperationWithImages(formData: FormData) {
    await auth(['admin']);
    const operationId = formData.get('operationId')
        ? Number(formData.get('operationId'))
        : undefined;
    const completedBy = formData.get('completedBy') as string | undefined;
    if (!operationId || !completedBy) {
        throw new Error('Operation ID and completedBy are required');
    }
    const files = formData.getAll('images');
    const imageUrls: string[] = [];
    for (const file of files) {
        if (typeof file === 'string') continue;
        const ext = file.name?.split('.').pop();
        const fileName = `operations/${operationId}/${randomUUID()}${
            ext ? `.${ext}` : ''
        }`;
        try {
            const { url } = await put(fileName, file, {
                access: 'public',
                token: process.env.BLOB_READ_WRITE_TOKEN,
            });
            if (url) imageUrls.push(url);
        } catch (err) {
            console.error('Error uploading image', fileName, err);
        }
    }
    await completeOperation(operationId, completedBy, imageUrls);
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

    const { operation } = await cancelOperation(
        {
            operationId,
            canceledBy: userId,
            reason,
        },
        undefined,
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
