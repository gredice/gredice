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
    verifiedAt?: Date | null;
    assignedUser?: {
        avatarUrl: string | null;
        displayName: string | null;
        userName: string;
    } | null;
};

type DetailedInspectionRaisedBed = {
    id: number;
    latestPhotoOperation?: {
        imageUrls: string[];
    } | null;
    name: string;
    physicalId?: string | null;
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
            operation.status !== 'completed' ||
            !operation.verifiedAt ||
            !operation.raisedBedId
        ) {
            return [];
        }

        const raisedBed = raisedBedById.get(operation.raisedBedId);
        if (!raisedBed) {
            return [];
        }

        const assignedFarmer = operation.assignedUser
            ? {
                  avatarUrl: operation.assignedUser.avatarUrl,
                  displayName:
                      operation.assignedUser.displayName?.trim() ||
                      operation.assignedUser.userName,
              }
            : null;

        return [
            {
                assignedFarmer,
                inspectedAt: (
                    operation.completedAt ?? notification.timestamp
                ).toISOString(),
                notes: operation.completionNotes?.trim() || null,
                notificationId: notification.id,
                operationId: operation.id,
                raisedBedId: raisedBed.id,
                raisedBedImageUrl:
                    raisedBed.latestPhotoOperation?.imageUrls[0] ?? null,
                raisedBedName: raisedBed.name,
                raisedBedPhysicalId: raisedBed.physicalId ?? null,
            },
        ];
    });
}
