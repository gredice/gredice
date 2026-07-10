import 'server-only';
import { plantFieldStatusLabel } from '@gredice/js/plants';
import { getEntitiesFormatted, getOperations } from '..';
import type { EntityStandardized } from '../@types/EntityStandardized';
import { getAllEvents, knownEventTypes } from './eventsRepo';
import type { getRaisedBedFieldsWithEvents } from './raisedBedFieldsRepo';
import { getRaisedBed } from './raisedBedsRepo';

type RaisedBedDiaryEntriesOptions = {
    includeUnverifiedOperationEvidence?: boolean;
};

function operationDiaryImageUrls(
    operation: DiaryOperation,
    options?: RaisedBedDiaryEntriesOptions,
) {
    if (
        options?.includeUnverifiedOperationEvidence === false &&
        operation.status !== 'completed'
    ) {
        return undefined;
    }

    return operation.imageUrls;
}

export async function getRaisedBedDiaryEntries(
    raisedBedId: number,
    options?: RaisedBedDiaryEntriesOptions,
) {
    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        throw new Error(`Raised bed with ID ${raisedBedId} not found`);
    }

    const [events, operationsData, operations] = await Promise.all([
        getAllEvents(
            [
                knownEventTypes.raisedBeds.create,
                knownEventTypes.raisedBeds.aiAnalysis,
                knownEventTypes.raisedBeds.delete,
                knownEventTypes.raisedBeds.abandon,
            ],
            [raisedBedId.toString()],
        ),
        getEntitiesFormatted<EntityStandardized>('operation'),
        // TODO: Maybe retrieve operations from other accounts as well, but anonimized
        raisedBed.accountId && raisedBed.gardenId
            ? await getOperations(
                  raisedBed.accountId,
                  raisedBed.gardenId,
                  raisedBedId,
              )
            : Promise.resolve([]),
    ]);

    const raisedBedsEventDiaryEntries = events
        .map((event) => {
            const data = event.data as Record<string, unknown> | undefined;
            let name = 'Nepoznato';
            let description = '';

            switch (event.type) {
                case knownEventTypes.raisedBeds.create: {
                    name = 'Gredica stvorena';
                    break;
                }
                case knownEventTypes.raisedBeds.aiAnalysis: {
                    name = 'Savjeti suncokreta';
                    description =
                        typeof data?.markdown === 'string'
                            ? data.markdown
                            : 'AI analiza je spremljena.';
                    break;
                }
                case knownEventTypes.raisedBeds.delete: {
                    name = 'Gredica obrisana';
                    break;
                }
                case knownEventTypes.raisedBeds.abandon: {
                    name = 'Gredica napuštena';
                    description =
                        data?.reason === 'inactivity'
                            ? 'Gredica je napuštena zbog neaktivnosti.'
                            : '';
                    break;
                }
            }

            return {
                id: event.id,
                name,
                description,
                status: null,
                timestamp: event.createdAt,
                imageUrls: Array.isArray(data?.imageUrls)
                    ? data.imageUrls.filter(
                          (url: unknown) => typeof url === 'string',
                      )
                    : typeof data?.imageUrl === 'string'
                      ? [data.imageUrl]
                      : undefined,
                isMarkdown:
                    event.type === knownEventTypes.raisedBeds.aiAnalysis,
            };
        })
        .filter((op) => op.name);
    const operationsDiaryEntries = operations
        .filter((op) => !op.raisedBedFieldId) // Filter out operations with raisedBedFieldId
        .map((op) => ({
            id: op.id,
            name:
                operationsData?.find((opData) => opData.id === op.entityId)
                    ?.information?.label ?? 'Nepoznato',
            description: operationsData?.find(
                (opData) => opData.id === op.entityId,
            )?.information?.shortDescription,
            status: operationStatusToLabel(op.status),
            timestamp: operationDiaryTimestamp(op),
            imageUrls: operationDiaryImageUrls(op, options),
            rescheduleTarget: operationDiaryRescheduleTarget(op),
        }))
        .filter((op) => op.name)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return [...raisedBedsEventDiaryEntries, ...operationsDiaryEntries].sort(
        (a, b) => {
            const aTime =
                a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
            const bTime =
                b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
            return bTime - aTime;
        },
    );
}

export async function getRaisedBedFieldDiaryEntries(
    raisedBedId: number,
    positionIndex: number,
    options?: RaisedBedDiaryEntriesOptions,
) {
    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        throw new Error(`Raised bed with ID ${raisedBedId} not found`);
    }

    const fields = raisedBed.fields.filter(
        (f) => f.positionIndex === positionIndex,
    );
    const [events, operationsData, operations] = await Promise.all([
        getAllEvents(
            [
                knownEventTypes.raisedBedFields.create,
                knownEventTypes.raisedBedFields.plantPlace,
                knownEventTypes.raisedBedFields.plantSchedule,
                knownEventTypes.raisedBedFields.plantUpdate,
                knownEventTypes.raisedBedFields.plantReplaceSort,
                knownEventTypes.raisedBedFields.aiAnalysis,
                knownEventTypes.raisedBedFields.delete,
            ],
            [`${raisedBedId.toString()}|${positionIndex.toString()}`],
        ),
        getEntitiesFormatted<EntityStandardized>('operation'),
        // TODO: Maybe retrieve operations from other accounts as well, but anonimized
        raisedBed.accountId && raisedBed.gardenId && fields.length > 0
            ? await getOperations(
                  raisedBed.accountId,
                  raisedBed.gardenId,
                  raisedBedId,
                  fields.map((f) => f.id),
              )
            : Promise.resolve([]),
    ]);

    const raisedBedsEventDiaryEntries = events
        .map((event) => {
            const data = event.data as Record<string, unknown> | undefined;
            let name = 'Nepoznato';
            let description = '';
            switch (event.type) {
                case knownEventTypes.raisedBedFields.create: {
                    name = 'Polje zauzeto';
                    description = 'Polje je zauzeto i spremno za sijanje.';
                    break;
                }
                case knownEventTypes.raisedBedFields.plantPlace: {
                    name = 'Zatraženo sijanje biljke';
                    description =
                        'Sijanje biljke je zatraženo i čeka na odobrenje.';
                    break;
                }
                case knownEventTypes.raisedBedFields.plantSchedule: {
                    name = 'Ažuriran termin sijanja';
                    description = 'Termin sijanja biljke je promijenjen.';
                    break;
                }
                case knownEventTypes.raisedBedFields.plantUpdate: {
                    const newStatus =
                        typeof event.data === 'object' &&
                        event.data !== null &&
                        'status' in event.data &&
                        typeof event.data.status === 'string'
                            ? event.data.status
                            : 'unknown';
                    const statusLabels = plantFieldStatusLabel(newStatus);
                    name = statusLabels.label;
                    description = statusLabels.description;
                    break;
                }
                case knownEventTypes.raisedBedFields.plantReplaceSort: {
                    name = 'Zamjena sorte biljke';
                    description = 'Za biljku je zamjenjena navedena sorta.';
                    break;
                }
                case knownEventTypes.raisedBedFields.delete: {
                    const cancellationReason =
                        typeof data?.reason === 'string'
                            ? data.reason.trim()
                            : '';
                    if (cancellationReason) {
                        name = 'Sijanje otkazano';
                        description = `Razlog otkazivanja: ${cancellationReason}`;
                    } else {
                        name = 'Polje uklonjeno';
                        description = 'Polje je uklonjeno.';
                    }
                    break;
                }
                case knownEventTypes.raisedBedFields.aiAnalysis: {
                    name = 'Savjeti suncokreta';
                    description =
                        typeof data?.markdown === 'string'
                            ? data.markdown
                            : 'AI analiza je spremljena.';
                    break;
                }
                default:
                    name = 'Nepoznato';
                    description = 'Nepoznata promjena.';
            }

            return {
                id: event.id,
                name,
                description,
                status: null,
                timestamp: event.createdAt,
                imageUrls: Array.isArray(data?.imageUrls)
                    ? data.imageUrls.filter(
                          (url: unknown) => typeof url === 'string',
                      )
                    : typeof data?.imageUrl === 'string'
                      ? [data.imageUrl]
                      : undefined,
                isMarkdown:
                    event.type === knownEventTypes.raisedBedFields.aiAnalysis,
            };
        })
        .filter((event) => event.name);

    const operationsDiaryEntries = operations
        .map((op) => ({
            id: op.id,
            name:
                operationsData?.find((opData) => opData.id === op.entityId)
                    ?.information?.label ?? 'Nepoznato',
            description: operationsData?.find(
                (opData) => opData.id === op.entityId,
            )?.information?.shortDescription,
            status: operationStatusToLabel(op.status),
            timestamp: operationDiaryTimestamp(op),
            imageUrls: operationDiaryImageUrls(op, options),
            rescheduleTarget: operationDiaryRescheduleTarget(op, positionIndex),
        }))
        .filter((op) => op.name)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const plannedFieldDiaryEntry = fieldPlantDiaryEntry(
        raisedBedId,
        positionIndex,
        fields,
    );

    return [
        ...raisedBedsEventDiaryEntries,
        ...operationsDiaryEntries,
        ...(plannedFieldDiaryEntry ? [plannedFieldDiaryEntry] : []),
    ].sort((a, b) => {
        const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
        const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
        return bTime - aTime;
    });
}

type DiaryRescheduleTarget =
    | {
          type: 'operation';
          operationId: number;
          raisedBedId: number | null;
          raisedBedFieldId: number | null;
          positionIndex?: number;
          scheduledDate: string;
      }
    | {
          type: 'raisedBedFieldPlant';
          raisedBedId: number;
          positionIndex: number;
          scheduledDate: string;
      };

type DiaryOperation = Awaited<ReturnType<typeof getOperations>>[number];
type RaisedBedFieldWithEvents = Awaited<
    ReturnType<typeof getRaisedBedFieldsWithEvents>
>[number];

const fieldPlantRescheduleStatuses = new Set(['new', 'planned']);

function operationDiaryTimestamp(operation: DiaryOperation) {
    return (
        operation.completedAt ??
        operation.scheduledDate ??
        operation.verifiedAt ??
        operation.canceledAt ??
        operation.createdAt
    );
}

function operationDiaryRescheduleTarget(
    operation: DiaryOperation,
    positionIndex?: number,
): DiaryRescheduleTarget | undefined {
    if (operation.status !== 'planned' || !operation.scheduledDate) {
        return undefined;
    }

    return {
        type: 'operation',
        operationId: operation.id,
        raisedBedId: operation.raisedBedId,
        raisedBedFieldId: operation.raisedBedFieldId,
        ...(positionIndex !== undefined ? { positionIndex } : {}),
        scheduledDate: operation.scheduledDate.toISOString(),
    };
}

function isPlannedFieldPlant(field: RaisedBedFieldWithEvents) {
    return (
        field.active &&
        Boolean(field.plantSortId) &&
        Boolean(field.plantScheduledDate) &&
        (!field.plantStatus ||
            fieldPlantRescheduleStatuses.has(field.plantStatus))
    );
}

function fieldPlantDiaryEntry(
    raisedBedId: number,
    positionIndex: number,
    fields: RaisedBedFieldWithEvents[],
) {
    const field = fields.find(
        (candidate) =>
            candidate.positionIndex === positionIndex &&
            isPlannedFieldPlant(candidate),
    );
    if (!field?.plantScheduledDate) {
        return null;
    }

    return {
        id: -field.id,
        name: 'Planirano sijanje',
        description: 'Sijanje biljke je planirano za odabrani datum.',
        status: 'Planirano',
        timestamp: field.plantScheduledDate,
        imageUrls: undefined,
        rescheduleTarget: {
            type: 'raisedBedFieldPlant',
            raisedBedId,
            positionIndex,
            scheduledDate: field.plantScheduledDate.toISOString(),
        } satisfies DiaryRescheduleTarget,
    };
}

export async function getRaisedBedAiHistoryEntries(raisedBedId: number) {
    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        return [];
    }

    const fieldPositionIndexes = Array.from(
        new Set(raisedBed.fields.map((field) => field.positionIndex)),
    );
    const aggregateIds = [
        raisedBedId.toString(),
        ...fieldPositionIndexes.map(
            (positionIndex) =>
                `${raisedBedId.toString()}|${positionIndex.toString()}`,
        ),
    ];

    const events = await getAllEvents(
        [
            knownEventTypes.raisedBeds.aiAnalysis,
            knownEventTypes.raisedBedFields.aiAnalysis,
        ],
        aggregateIds,
    );

    return events
        .map((event) => {
            const data = event.data as Record<string, unknown> | undefined;
            const imageUrls = Array.isArray(data?.imageUrls)
                ? data.imageUrls.filter(
                      (url: unknown): url is string => typeof url === 'string',
                  )
                : typeof data?.imageUrl === 'string'
                  ? [data.imageUrl]
                  : undefined;
            return {
                id: event.id,
                description:
                    typeof data?.markdown === 'string'
                        ? data.markdown
                        : undefined,
                timestamp: event.createdAt,
                imageUrls,
                isMarkdown: true,
            };
        })
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

function operationStatusToLabel(status: string) {
    switch (status) {
        case 'new':
            return 'Novo';
        case 'completed':
            return 'Završeno';
        case 'pendingVerification':
            return 'Završeno';
        case 'planned':
            return 'Planirano';
        case 'canceled':
            return 'Otkazano';
        case 'failed':
            return 'Neuspješno';
        default:
            return 'Nepoznato';
    }
}
