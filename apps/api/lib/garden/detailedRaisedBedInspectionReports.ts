import { RAISED_BED_DETAILED_INSPECTION_OPERATION_ID } from '@gredice/storage';

type DetailedInspectionNotification = {
    id: string;
    metadata: Record<string, unknown>;
    timestamp: Date;
};

type DetailedInspectionOperation = {
    accountId?: string | null;
    completedAt?: Date | null;
    completionNotes?: string | null;
    entityId: number;
    gardenId?: number | null;
    id: number;
    raisedBedId?: number | null;
    status: string;
};

type DetailedInspectionRaisedBed = {
    id: number;
    name: string;
};

export function detailedInspectionOperationId(
    metadata: Record<string, unknown>,
) {
    const operationId = metadata.operationId;
    return typeof operationId === 'number' &&
        Number.isSafeInteger(operationId) &&
        operationId > 0
        ? operationId
        : null;
}

export function buildDetailedRaisedBedInspectionReports({
    accountId,
    gardenId,
    notifications,
    operations,
    raisedBeds,
}: {
    accountId: string;
    gardenId: number;
    notifications: DetailedInspectionNotification[];
    operations: DetailedInspectionOperation[];
    raisedBeds: DetailedInspectionRaisedBed[];
}) {
    const operationById = new Map(
        operations.map((operation) => [operation.id, operation]),
    );
    const raisedBedById = new Map(
        raisedBeds.map((raisedBed) => [raisedBed.id, raisedBed]),
    );

    return notifications.flatMap((notification) => {
        const operationId = detailedInspectionOperationId(
            notification.metadata,
        );
        const operation =
            operationId === null ? undefined : operationById.get(operationId);
        if (
            !operation ||
            operation.accountId !== accountId ||
            operation.gardenId !== gardenId ||
            operation.entityId !==
                RAISED_BED_DETAILED_INSPECTION_OPERATION_ID ||
            (operation.status !== 'pendingVerification' &&
                operation.status !== 'completed') ||
            !operation.raisedBedId
        ) {
            return [];
        }

        const raisedBed = raisedBedById.get(operation.raisedBedId);
        if (!raisedBed) {
            return [];
        }

        return [
            {
                inspectedAt: (
                    operation.completedAt ?? notification.timestamp
                ).toISOString(),
                notes: operation.completionNotes?.trim() || null,
                notificationId: notification.id,
                operationId: operation.id,
                raisedBedId: raisedBed.id,
                raisedBedName: raisedBed.name,
            },
        ];
    });
}
