import {
    type ApprovalRequest,
    type EntityStandardized,
    getAllOperations,
    getAllRaisedBeds,
    getApprovalRequests,
    getEntitiesFormatted,
} from '@gredice/storage';

import { serializeOperationDefinitionForList } from '../app/admin/operations/operationListDefinitionVisual';
import type { EntityStandardized as OperationEntityStandardized } from '../lib/@types/EntityStandardized';

type ApprovalTaskBase = {
    id: string;
    title: string;
    description: string;
    receivedAt: Date;
    plantImageUrl?: string;
    accountId?: string | null;
    gardenId?: number | null;
    raisedBedId?: number | null;
    raisedBedPhysicalId?: string | null;
    positionIndex?: number | null;
};

export type AdminApprovalTask =
    | (ApprovalTaskBase & {
          kind: 'plantStatusRequest';
          requestId: string;
          currentStatus?: string | null;
          requestedStatus: string;
          requestedBy: string;
          note?: string | null;
      })
    | (ApprovalTaskBase & {
          kind: 'scheduleOperationVerification';
          operationId: number;
          operationDefinition: ReturnType<
              typeof serializeOperationDefinitionForList
          >;
          expectedEntityId: number;
          expectedTaskVersionEventId: number;
          completedBy?: string | null;
      })
    | (ApprovalTaskBase & {
          kind: 'schedulePlantingVerification';
          expectedPlantCycleEventId: number;
          expectedPlantCycleVersionEventId: number;
          expectedPlantSortId: number;
          raisedBedId: number;
          positionIndex: number;
      });

function entityLabel(
    entity: EntityStandardized | OperationEntityStandardized | undefined,
    fallback: string,
) {
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

function plantSortImageUrl(plantSort: EntityStandardized | undefined) {
    return (
        plantSort?.image?.cover?.url ??
        plantSort?.images?.cover?.url ??
        plantSort?.information?.plant?.image?.cover?.url ??
        plantSort?.information?.plant?.images?.cover?.url
    );
}

function raisedBedFieldLabel(positionIndex?: number | null) {
    return positionIndex === null || positionIndex === undefined
        ? null
        : `Polje ${positionIndex + 1}`;
}

function approvalRequestRequesterLabel(requestedBy: string) {
    if (requestedBy === 'automation:raised-bed-image-status-review') {
        return 'AI analiza gredice';
    }
    if (requestedBy === 'automation:harvest-operation-status-review') {
        return 'Automatizacija nakon berbe';
    }

    return requestedBy;
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
    const plantName = plantSortName(plantSortsById, request.target.plantSortId);
    const fieldLabel = raisedBedFieldLabel(request.target.positionIndex);

    return {
        id: `approval:${request.id}`,
        kind: 'plantStatusRequest',
        requestId: request.id,
        title: 'Promjena stanja biljke',
        description: `${fieldLabel ? `${fieldLabel}: ` : ''}${plantName}`,
        receivedAt: request.requestedAt,
        plantImageUrl: plantSortImageUrl(
            plantSortsById.get(request.target.plantSortId ?? 0),
        ),
        accountId: request.target.accountId,
        gardenId: request.target.gardenId,
        raisedBedId: request.target.raisedBedId,
        raisedBedPhysicalId: raisedBed?.physicalId,
        positionIndex: request.target.positionIndex,
        currentStatus: request.target.currentStatus,
        requestedStatus: request.target.requestedStatus,
        requestedBy: approvalRequestRequesterLabel(request.requestedBy),
        note: request.note,
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
        getEntitiesFormatted<OperationEntityStandardized>('operation'),
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
            const raisedBed =
                operation.raisedBedId != null
                    ? raisedBedsById.get(operation.raisedBedId)
                    : undefined;

            return {
                id: `operation:${operation.id}`,
                kind: 'scheduleOperationVerification',
                operationId: operation.id,
                operationDefinition: serializeOperationDefinitionForList(
                    operationsById.get(operation.entityId),
                    operationName,
                ),
                expectedEntityId: operation.entityId,
                expectedTaskVersionEventId: operation.taskVersionEventId,
                title: 'Verifikacija radnje',
                description:
                    operation.raisedBedId != null
                        ? operationName
                        : `${operationName} • Farma`,
                receivedAt:
                    operation.completedAt ??
                    operation.scheduledDate ??
                    operation.createdAt,
                accountId: operation.accountId,
                gardenId: operation.gardenId,
                raisedBedId: operation.raisedBedId,
                raisedBedPhysicalId: raisedBed?.physicalId,
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
            .flatMap((field) => {
                const activePlantCycle = field.plantCycles.find(
                    (plantCycle) => plantCycle.active,
                );
                if (!activePlantCycle || !field.plantSortId) {
                    return [];
                }
                const fieldLabel = raisedBedFieldLabel(field.positionIndex);

                return [
                    {
                        id: `planting:${field.id}`,
                        kind: 'schedulePlantingVerification' as const,
                        expectedPlantCycleEventId:
                            activePlantCycle.plantPlaceEventId,
                        expectedPlantCycleVersionEventId:
                            activePlantCycle.endedEventId,
                        expectedPlantSortId: field.plantSortId,
                        raisedBedId: raisedBed.id,
                        positionIndex: field.positionIndex,
                        title: 'Verifikacija sijanja',
                        description: `${fieldLabel ? `${fieldLabel}: ` : ''}${plantSortName(plantSortsById, field.plantSortId)}`,
                        receivedAt: field.plantSowDate ?? field.updatedAt,
                        plantImageUrl: plantSortImageUrl(
                            plantSortsById.get(field.plantSortId),
                        ),
                        accountId: raisedBed.accountId,
                        gardenId: raisedBed.gardenId,
                        raisedBedPhysicalId: raisedBed.physicalId,
                    },
                ];
            }),
    );

    return [...plantStatusTasks, ...operationTasks, ...plantingTasks].sort(
        (left, right) => right.receivedAt.getTime() - left.receivedAt.getTime(),
    );
}

export async function getPendingAdminApprovalTaskCount() {
    const tasks = await getPendingAdminApprovalTasks();
    return tasks.length;
}
