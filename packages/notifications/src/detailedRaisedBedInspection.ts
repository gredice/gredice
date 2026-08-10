import { detailedRaisedBedInspectionNotificationType } from '@gredice/js/notifications';
import { getRaisedBedCloseupUrl } from '@gredice/js/urls';
import {
    createNotification,
    getOperationById,
    getRaisedBed,
    RAISED_BED_DETAILED_INSPECTION_OPERATION_ID,
} from '@gredice/storage';

export function buildDetailedRaisedBedInspectionNotification({
    gardenId,
    operationId,
    raisedBedId,
    raisedBedName,
}: {
    gardenId: number;
    operationId: number;
    raisedBedId: number;
    raisedBedName: string;
}) {
    return {
        category: 'garden',
        content: `Farmer je završio detaljan pregled gredice **${raisedBedName}**. U vrtu te čekaju njegove bilješke.`,
        gardenId,
        header: 'Novi detaljan pregled gredice',
        linkUrl: getRaisedBedCloseupUrl(raisedBedName),
        metadata: {
            operationId,
        },
        raisedBedId,
        type: detailedRaisedBedInspectionNotificationType,
    } as const;
}

export async function notifyDetailedRaisedBedInspectionCompleted(
    operationId: number,
) {
    const operation = await getOperationById(operationId);
    if (operation.entityId !== RAISED_BED_DETAILED_INSPECTION_OPERATION_ID) {
        return false;
    }

    if (
        !operation.accountId ||
        !operation.gardenId ||
        !operation.raisedBedId ||
        !operation.completionEventId ||
        !operation.completedAt
    ) {
        throw new Error(
            'Completed detailed raised bed inspection is missing its account, garden, raised bed, or completion event.',
        );
    }

    const raisedBed = await getRaisedBed(operation.raisedBedId);
    if (!raisedBed?.name) {
        throw new Error(
            'Completed detailed raised bed inspection is missing its raised bed.',
        );
    }

    await createNotification(
        {
            accountId: operation.accountId,
            timestamp: operation.completedAt,
            ...buildDetailedRaisedBedInspectionNotification({
                gardenId: operation.gardenId,
                operationId: operation.id,
                raisedBedId: operation.raisedBedId,
                raisedBedName: raisedBed.name,
            }),
        },
        {
            idempotencyKey: `schedule-task:detailed-raised-bed-inspection:${operation.completionEventId.toString()}`,
        },
    );

    return true;
}
