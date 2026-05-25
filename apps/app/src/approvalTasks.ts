import { plantFieldStatusLabel } from '@gredice/js/plants';
import {
    type ApprovalRequest,
    type EntityStandardized,
    getAllOperations,
    getAllRaisedBeds,
    getApprovalRequests,
    getEntitiesFormatted,
} from '@gredice/storage';

type ApprovalTaskBase = {
    id: string;
    title: string;
    description: string;
    receivedAt: Date;
    accountId?: string | null;
    gardenId?: number | null;
    raisedBedId?: number | null;
    positionIndex?: number | null;
};

export type AdminApprovalTask =
    | (ApprovalTaskBase & {
          kind: 'plantStatusRequest';
          requestId: string;
          currentStatus?: string | null;
          requestedStatus: string;
          requestedBy: string;
      })
    | (ApprovalTaskBase & {
          kind: 'scheduleOperationVerification';
          operationId: number;
          completedBy?: string | null;
      })
    | (ApprovalTaskBase & {
          kind: 'schedulePlantingVerification';
          raisedBedId: number;
          positionIndex: number;
      });

function entityLabel(entity: EntityStandardized | undefined, fallback: string) {
    return entity?.information?.label ?? entity?.information?.name ?? fallback;
}

function plantSortName(
    plantSortsById: Map<number, EntityStandardized>,
    plantSortId?: number | null,
) {
    if (!plantSortId) {
        return 'Nepoznata biljka';
    }

    return entityLabel(
        plantSortsById.get(plantSortId),
        `Sorta #${plantSortId}`,
    );
}

function raisedBedLabel(input: {
    raisedBedName?: string | null;
    physicalId?: string | null;
    raisedBedId: number;
    positionIndex?: number | null;
}) {
    const base =
        input.raisedBedName ??
        (input.physicalId ? `Gredica ${input.physicalId}` : null) ??
        `Gredica #${input.raisedBedId}`;

    return input.positionIndex === null || input.positionIndex === undefined
        ? base
        : `${base}, polje ${input.positionIndex + 1}`;
}

function buildPlantStatusRequestTask(
    request: ApprovalRequest,
    plantSortsById: Map<number, EntityStandardized>,
    raisedBedsById: Map<
        number,
        Awaited<ReturnType<typeof getAllRaisedBeds>>[number]
    >,
): AdminApprovalTask | null {
    if (request.target.kind !== 'raisedBedField.plantStatus') {
        return null;
    }

    const raisedBed = raisedBedsById.get(request.target.raisedBedId);
    const currentStatusLabel = request.target.currentStatus
        ? plantFieldStatusLabel(request.target.currentStatus).shortLabel
        : 'Nepoznato';
    const requestedStatusLabel = plantFieldStatusLabel(
        request.target.requestedStatus,
    ).shortLabel;
    const plantName = plantSortName(plantSortsById, request.target.plantSortId);
    const targetLabel = raisedBedLabel({
        raisedBedName: raisedBed?.name,
        physicalId: raisedBed?.physicalId,
        raisedBedId: request.target.raisedBedId,
        positionIndex: request.target.positionIndex,
    });

    return {
        id: `approval:${request.id}`,
        kind: 'plantStatusRequest',
        requestId: request.id,
        title: 'Promjena stanja biljke',
        description: `${targetLabel}: ${plantName}, ${currentStatusLabel} → ${requestedStatusLabel}`,
        receivedAt: request.requestedAt,
        accountId: request.target.accountId,
        gardenId: request.target.gardenId,
        raisedBedId: request.target.raisedBedId,
        positionIndex: request.target.positionIndex,
        currentStatus: request.target.currentStatus,
        requestedStatus: request.target.requestedStatus,
        requestedBy: request.requestedBy,
    };
}

export async function getPendingAdminApprovalTasks() {
    const [
        pendingApprovalRequests,
        pendingOperations,
        raisedBeds,
        operationsData,
        plantSorts,
    ] = await Promise.all([
        getApprovalRequests({ status: 'pending' }),
        getAllOperations({ status: 'pendingVerification' }),
        getAllRaisedBeds(),
        getEntitiesFormatted<EntityStandardized>('operation'),
        getEntitiesFormatted<EntityStandardized>('plantSort'),
    ]);

    const operationsById = new Map(
        (operationsData ?? []).map((operation) => [operation.id, operation]),
    );
    const plantSortsById = new Map(
        (plantSorts ?? []).map((plantSort) => [plantSort.id, plantSort]),
    );
    const raisedBedsById = new Map(
        raisedBeds.map((raisedBed) => [raisedBed.id, raisedBed]),
    );
    const plantStatusTasks = pendingApprovalRequests
        .map((request) =>
            buildPlantStatusRequestTask(
                request,
                plantSortsById,
                raisedBedsById,
            ),
        )
        .filter((task): task is AdminApprovalTask => Boolean(task));

    const operationTasks: AdminApprovalTask[] = pendingOperations.map(
        (operation) => {
            const operationName = entityLabel(
                operationsById.get(operation.entityId),
                `Radnja #${operation.entityId}`,
            );
            const raisedBed = operation.raisedBedId
                ? raisedBedsById.get(operation.raisedBedId)
                : undefined;
            const targetLabel = operation.raisedBedId
                ? raisedBedLabel({
                      raisedBedName: raisedBed?.name,
                      physicalId: raisedBed?.physicalId,
                      raisedBedId: operation.raisedBedId,
                  })
                : 'Farma';

            return {
                id: `operation:${operation.id}`,
                kind: 'scheduleOperationVerification',
                operationId: operation.id,
                title: 'Verifikacija radnje',
                description: `${operationName} • ${targetLabel}`,
                receivedAt:
                    operation.completedAt ??
                    operation.scheduledDate ??
                    operation.createdAt,
                accountId: operation.accountId,
                gardenId: operation.gardenId,
                raisedBedId: operation.raisedBedId,
                positionIndex: null,
                completedBy: operation.completedBy,
            };
        },
    );

    const plantingTasks: AdminApprovalTask[] = raisedBeds.flatMap((raisedBed) =>
        raisedBed.fields
            .filter(
                (field) =>
                    field.active && field.plantStatus === 'pendingVerification',
            )
            .map((field) => ({
                id: `planting:${field.id}`,
                kind: 'schedulePlantingVerification',
                raisedBedId: raisedBed.id,
                positionIndex: field.positionIndex,
                title: 'Verifikacija sijanja',
                description: `${raisedBedLabel({
                    raisedBedName: raisedBed.name,
                    physicalId: raisedBed.physicalId,
                    raisedBedId: raisedBed.id,
                    positionIndex: field.positionIndex,
                })}: ${plantSortName(plantSortsById, field.plantSortId)}`,
                receivedAt: field.plantSowDate ?? field.updatedAt,
                accountId: raisedBed.accountId,
                gardenId: raisedBed.gardenId,
            })),
    );

    return [...plantStatusTasks, ...operationTasks, ...plantingTasks].sort(
        (left, right) => right.receivedAt.getTime() - left.receivedAt.getTime(),
    );
}

export async function getPendingAdminApprovalTaskCount() {
    const tasks = await getPendingAdminApprovalTasks();
    return tasks.length;
}
