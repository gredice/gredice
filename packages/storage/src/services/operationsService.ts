import type { EntityStandardized } from '../@types/EntityStandardized';
import { earnSunflowers } from '../repositories/accountsRepo';
import { getEntityFormatted } from '../repositories/entitiesRepo';
import { createEvent, knownEvents } from '../repositories/eventsRepo';
import { getRaisedBed } from '../repositories/gardensRepo';
import { createNotification } from '../repositories/notificationsRepo';
import { getOperationById } from '../repositories/operationsRepo';

export class OperationNotFoundError extends Error {
    constructor(message = 'Operation not found') {
        super(message);
        this.name = 'OperationNotFoundError';
    }
}

export class OperationInvalidStateError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'OperationInvalidStateError';
    }
}

export class OperationValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'OperationValidationError';
    }
}

type OperationValidationOptions = {
    accountId?: string;
    gardenId?: number;
    raisedBedId?: number;
};

async function fetchOperation(operationId: number) {
    try {
        return await getOperationById(operationId);
    } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
            throw new OperationNotFoundError();
        }
        throw error;
    }
}

function assertOperationAccess(
    operation: Awaited<ReturnType<typeof getOperationById>>,
    options?: OperationValidationOptions,
) {
    if (!options) {
        return;
    }

    if (
        (options.accountId && operation.accountId !== options.accountId) ||
        (options.gardenId && operation.gardenId !== options.gardenId) ||
        (options.raisedBedId && operation.raisedBedId !== options.raisedBedId)
    ) {
        throw new OperationNotFoundError();
    }
}

export async function rescheduleOperation(
    operationId: number,
    scheduledDate: Date,
    options?: OperationValidationOptions,
) {
    if (
        !(scheduledDate instanceof Date) ||
        Number.isNaN(scheduledDate.getTime())
    ) {
        throw new OperationValidationError('Scheduled date is invalid');
    }

    const operation = await fetchOperation(operationId);
    assertOperationAccess(operation, options);

    await createEvent(
        knownEvents.operations.scheduledV1(operationId.toString(), {
            scheduledDate: scheduledDate.toISOString(),
        }),
    );

    return operation;
}

export async function cancelOperation(
    {
        operationId,
        canceledBy,
        reason,
    }: {
        operationId: number;
        canceledBy: string;
        reason: string;
    },
    options?: OperationValidationOptions,
) {
    if (!reason || reason.trim().length === 0) {
        throw new OperationValidationError('Cancellation reason is required');
    }

    const operation = await fetchOperation(operationId);
    assertOperationAccess(operation, options);

    if (
        operation.status === 'completed' ||
        operation.status === 'failed' ||
        operation.status === 'canceled'
    ) {
        throw new OperationInvalidStateError(
            `Cannot cancel operation with status ${operation.status}`,
        );
    }

    const operationData = await getEntityFormatted<EntityStandardized>(
        operation.entityId,
    );

    const refundAmount = operationData?.prices?.perOperation
        ? Math.round(operationData.prices.perOperation * 1000)
        : 0;

    let content = `Radnja **${operationData?.information?.label}** je otkazana.`;
    if (operation.raisedBedId) {
        const raisedBed = await getRaisedBed(operation.raisedBedId);
        if (raisedBed) {
            const positionIndex = operation.raisedBedFieldId
                ? (raisedBed.fields.find(
                      (field) => field.id === operation.raisedBedFieldId,
                  )?.positionIndex ?? null)
                : null;
            if (typeof positionIndex === 'number') {
                content = `Radnja **${operationData?.information?.label}** na gredici **${raisedBed.name}** za polje **${positionIndex + 1}** je otkazana.`;
            } else {
                content = `Radnja **${operationData?.information?.label}** na gredici **${raisedBed.name}** je otkazana.`;
            }
        }
    }

    if (reason) {
        content += `\nRazlog otkazivanja: ${reason}`;
    }

    if (refundAmount > 0) {
        content += `\nSredstva su ti vraćana u iznosu od ${refundAmount} 🌻.`;
    }

    await Promise.all([
        createEvent(
            knownEvents.operations.canceledV1(operationId.toString(), {
                canceledBy,
                reason,
            }),
        ),
        refundAmount > 0 && operation.accountId
            ? earnSunflowers(
                  operation.accountId,
                  refundAmount,
                  `refund:operation:${operationId}`,
              )
            : Promise.resolve(),
        operation.accountId
            ? createNotification({
                  accountId: operation.accountId,
                  gardenId: operation.gardenId,
                  raisedBedId: operation.raisedBedId,
                  header: 'Radnje je otkazana',
                  content,
                  timestamp: new Date(),
              })
            : undefined,
    ]);

    return {
        operation,
        refundAmount,
    };
}
