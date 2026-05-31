import type { FieldOperationLabelData } from '@gredice/label-printer';
import type { EntityStandardized } from '@gredice/storage';
import { Checkbox } from '@gredice/ui/Checkbox';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { CompleteOperationModal } from './CompleteOperationModal';
import { FieldOperationPrintModal } from './FieldOperationPrintModal';
import { OperationCompletionAttachments } from './OperationCompletionAttachments';
import type { FarmScheduleDayData } from './scheduleData';
import {
    formatMinutes,
    getOperationDurationMinutes,
    groupRaisedBedsForSchedule,
    isOperationCompleted,
} from './scheduleShared';

type FarmRaisedBed = FarmScheduleDayData['raisedBeds'][number];
type FarmOperation = FarmScheduleDayData['scheduledOperations'][number];
type FarmOperationCardData = FarmOperation & {
    durationMinutes: number;
    label: string;
};
const RAISED_BED_FIELDS_PER_BLOCK = 9;

interface FarmScheduleOperationsSectionProps {
    raisedBeds: FarmScheduleDayData['raisedBeds'];
    scheduledOperations: FarmScheduleDayData['scheduledOperations'];
    plantSorts: EntityStandardized[] | null | undefined;
    operationsData: EntityStandardized[] | null | undefined;
    userId: string;
}

function buildOperationLabel(
    operation: FarmOperation,
    raisedBeds: FarmRaisedBed[],
    plantSortById: Map<number, EntityStandardized>,
    operationDataById: Map<number, EntityStandardized>,
) {
    const operationData = operationDataById.get(operation.entityId);
    const field = operation.raisedBedFieldId
        ? raisedBeds
              .flatMap((raisedBed) => raisedBed.fields)
              .find(
                  (raisedBedField) =>
                      raisedBedField.id === operation.raisedBedFieldId,
              )
        : undefined;
    const sort = field?.plantSortId
        ? plantSortById.get(field.plantSortId)
        : undefined;
    const physicalPositionIndex = field
        ? getFieldPhysicalPositionIndex(field, raisedBeds).toString()
        : '';
    const isFullRaisedBed =
        operationData?.attributes?.application === 'raisedBedFull';

    return `${isFullRaisedBed || !physicalPositionIndex ? '' : `${physicalPositionIndex} - `}${operationData?.information?.label ?? operation.entityId}${sort ? `: ${sort.information?.name ?? 'Nepoznato'}` : ''}`;
}

function isHarvestOperation(operationData: EntityStandardized | undefined) {
    const stageName =
        operationData?.attributes?.stage?.information?.name?.toLowerCase();
    if (stageName === 'harvest') {
        return true;
    }

    const operationName = operationData?.information?.name?.toLowerCase();
    return (
        operationName === 'harvestplant' ||
        operationName === 'harvestall' ||
        operationName === 'harvestmature' ||
        operationName === 'harvest50mature' ||
        operationName === 'harvest25mature'
    );
}

function shouldPrintOperationLabel(
    operationData: EntityStandardized | undefined,
) {
    return (
        operationData?.attributes?.printLabel === true ||
        isHarvestOperation(operationData)
    );
}

function getOperationDetailLabel(
    operation: FarmOperationCardData,
    operationData: EntityStandardized | undefined,
) {
    return (
        operationData?.information?.label ??
        operationData?.information?.name ??
        operation.label
    );
}

function getFieldPhysicalPositionIndex(
    field: FarmRaisedBed['fields'][number],
    raisedBeds: FarmRaisedBed[],
) {
    const raisedBedIndex = [...raisedBeds]
        .sort((left, right) => left.id - right.id)
        .findIndex((raisedBed) => raisedBed.id === field.raisedBedId);

    return (
        field.positionIndex +
        1 +
        Math.max(raisedBedIndex, 0) * RAISED_BED_FIELDS_PER_BLOCK
    );
}

function buildHarvestLabelData(
    operation: FarmOperation,
    raisedBeds: FarmRaisedBed[],
    plantSortById: Map<number, EntityStandardized>,
    detailLabel: string,
): FieldOperationLabelData | null {
    if (!operation.raisedBedFieldId || operation.raisedBedId === null) {
        return null;
    }

    const raisedBed = raisedBeds.find(
        (candidate) => candidate.id === operation.raisedBedId,
    );
    const field = raisedBed?.fields.find(
        (candidate) => candidate.id === operation.raisedBedFieldId,
    );
    const plantSortName = field?.plantSortId
        ? plantSortById.get(field.plantSortId)?.information?.name
        : undefined;

    if (!raisedBed?.physicalId || field?.positionIndex === undefined) {
        return null;
    }

    if (!plantSortName) {
        return null;
    }

    return {
        raisedBedPhysicalId: raisedBed.physicalId,
        fieldLabel: getFieldPhysicalPositionIndex(field, raisedBeds).toString(),
        detailLabel,
        plantSortName,
    };
}

function renderHarvestLabelDescription(
    operationLabel: string,
    labelData: FieldOperationLabelData,
) {
    return (
        <Typography>
            Etiketa za <strong>{operationLabel}</strong> sadržavat će gredicu{' '}
            <strong>{labelData.raisedBedPhysicalId}</strong>, polje{' '}
            <strong>{labelData.fieldLabel}</strong> i sortu{' '}
            <strong>{labelData.plantSortName}</strong>.
        </Typography>
    );
}

export function FarmScheduleOperationsSection({
    raisedBeds,
    scheduledOperations,
    plantSorts,
    operationsData,
    userId,
}: FarmScheduleOperationsSectionProps) {
    if (scheduledOperations.length === 0) {
        return null;
    }

    const operationDataById = new Map<number, EntityStandardized>();
    if (operationsData) {
        for (const operationData of operationsData) {
            operationDataById.set(operationData.id, operationData);
        }
    }

    const plantSortById = new Map<number, EntityStandardized>();
    if (plantSorts) {
        for (const plantSort of plantSorts) {
            plantSortById.set(plantSort.id, plantSort);
        }
    }

    const affectedRaisedBedIds = [
        ...new Set(
            scheduledOperations
                .map((operation) => operation.raisedBedId)
                .filter((id): id is number => id !== null),
        ),
    ];
    const raisedBedGroups = groupRaisedBedsForSchedule(
        raisedBeds,
        affectedRaisedBedIds,
    );
    const farmOperations = scheduledOperations
        .filter(
            (operation) =>
                typeof operation.farmId === 'number' &&
                operation.raisedBedId === null,
        )
        .map((operation) => {
            const label = buildOperationLabel(
                operation,
                raisedBeds,
                plantSortById,
                operationDataById,
            );
            const durationMinutes = getOperationDurationMinutes(
                operationDataById.get(operation.entityId),
            );

            return {
                ...operation,
                durationMinutes,
                label,
            };
        })
        .sort((left, right) =>
            left.label.localeCompare(right.label, undefined, {
                numeric: true,
            }),
        );

    function renderOperationCard(
        operation: FarmOperationCardData,
        groupedRaisedBeds: FarmRaisedBed[],
    ) {
        const completed = isOperationCompleted(operation.status);
        const operationData = operationDataById.get(operation.entityId);
        const canComplete =
            !completed &&
            (!operation.assignedUserId || operation.assignedUserId === userId);
        const harvestLabelData = shouldPrintOperationLabel(operationData)
            ? buildHarvestLabelData(
                  operation,
                  groupedRaisedBeds,
                  plantSortById,
                  getOperationDetailLabel(operation, operationData),
              )
            : null;
        const attachImages = Boolean(
            operationData?.conditions?.completionAttachImages ||
                operationData?.conditions?.completionAttachImagesRequired,
        );
        const attachImagesRequired = Boolean(
            operationData?.conditions?.completionAttachImagesRequired,
        );
        const attachNotes = Boolean(
            operationData?.conditions?.completionAttachNotes ||
                operationData?.conditions?.completionAttachNotesRequired,
        );
        const attachNotesRequired = Boolean(
            operationData?.conditions?.completionAttachNotesRequired,
        );
        const completionRequirementTexts = [
            attachImages
                ? attachImagesRequired
                    ? 'Slike obavezne'
                    : 'Slike opcionalne'
                : null,
            attachNotes
                ? attachNotesRequired
                    ? 'Napomena obavezna'
                    : 'Napomena opcionalna'
                : null,
        ].filter((text): text is string => Boolean(text));

        return (
            <div
                key={operation.id}
                className="rounded-lg border bg-white px-3 py-2"
            >
                <Row
                    spacing={2}
                    className="min-w-0 items-start justify-between gap-3"
                >
                    <Row spacing={2} className="min-w-0 grow items-start">
                        {completed ? (
                            <Checkbox className="size-5" checked disabled />
                        ) : canComplete ? (
                            <CompleteOperationModal
                                operationId={operation.id}
                                label={operation.label}
                                conditions={operationData?.conditions}
                            />
                        ) : (
                            <div title="Radnja je dodijeljena drugom korisniku.">
                                <Checkbox className="size-5" disabled />
                            </div>
                        )}
                        <Stack spacing={1} className="min-w-0 grow">
                            <Typography
                                className={
                                    completed
                                        ? 'line-through text-muted-foreground [overflow-wrap:anywhere]'
                                        : '[overflow-wrap:anywhere]'
                                }
                            >
                                {operation.label}
                            </Typography>
                            <Row
                                spacing={2}
                                className="items-center flex-wrap gap-y-1"
                            >
                                <Typography
                                    level="body2"
                                    className={
                                        completed
                                            ? 'text-green-600'
                                            : 'text-muted-foreground'
                                    }
                                >
                                    {completed ? 'Završeno' : 'Potvrđeno'}
                                </Typography>
                                {operation.durationMinutes > 0 && (
                                    <Typography
                                        level="body2"
                                        className="text-muted-foreground"
                                    >
                                        {formatMinutes(
                                            operation.durationMinutes,
                                        )}
                                    </Typography>
                                )}
                                <Typography
                                    level="body2"
                                    className="text-muted-foreground"
                                >
                                    {operation.scheduledDate ? (
                                        <>
                                            Planirano:{' '}
                                            <LocalDateTime time={false}>
                                                {operation.scheduledDate}
                                            </LocalDateTime>
                                        </>
                                    ) : (
                                        'Danas'
                                    )}
                                </Typography>
                                {!completed &&
                                    completionRequirementTexts.length > 0 && (
                                        <Typography
                                            level="body2"
                                            className="text-xs text-muted-foreground"
                                        >
                                            {completionRequirementTexts.join(
                                                ' · ',
                                            )}
                                        </Typography>
                                    )}
                                {harvestLabelData && (
                                    <FieldOperationPrintModal
                                        title="Ispis etikete za berbu"
                                        labelData={harvestLabelData}
                                        description={renderHarvestLabelDescription(
                                            operation.label,
                                            harvestLabelData,
                                        )}
                                    />
                                )}
                            </Row>
                        </Stack>
                    </Row>
                    {(completed || operation.assignedUser) && (
                        <Row spacing={1} className="shrink-0 items-center">
                            {completed && (
                                <OperationCompletionAttachments
                                    operationId={operation.id}
                                    notes={operation.completionNotes}
                                    imageUrls={operation.imageUrls}
                                />
                            )}
                            {operation.assignedUser && (
                                <div
                                    className="shrink-0"
                                    title={`Dodijeljeno: ${operation.assignedUser.displayName ?? operation.assignedUser.userName}`}
                                >
                                    <UserAvatar
                                        avatarUrl={
                                            operation.assignedUser.avatarUrl
                                        }
                                        displayName={
                                            operation.assignedUser
                                                .displayName ??
                                            operation.assignedUser.userName
                                        }
                                        className="size-7 rounded-full"
                                    />
                                </div>
                            )}
                        </Row>
                    )}
                </Row>
            </div>
        );
    }

    return (
        <Stack spacing={4}>
            {farmOperations.length > 0 && (
                <Stack spacing={2}>
                    <Row spacing={2} className="items-center flex-wrap gap-y-1">
                        <Typography semiBold>Farma</Typography>
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            {farmOperations.length} zadataka
                        </Typography>
                    </Row>
                    <Stack spacing={2}>
                        {farmOperations.map((operation) =>
                            renderOperationCard(operation, raisedBeds),
                        )}
                    </Stack>
                </Stack>
            )}
            {raisedBedGroups.map(
                ({ key, physicalId, raisedBeds: groupedRaisedBeds }) => {
                    const dayOperations = scheduledOperations
                        .filter(
                            (operation) =>
                                operation.raisedBedId !== null &&
                                groupedRaisedBeds.some(
                                    (raisedBed) =>
                                        raisedBed.id === operation.raisedBedId,
                                ),
                        )
                        .map((operation) => {
                            const label = buildOperationLabel(
                                operation,
                                groupedRaisedBeds,
                                plantSortById,
                                operationDataById,
                            );
                            const durationMinutes = getOperationDurationMinutes(
                                operationDataById.get(operation.entityId),
                            );

                            return {
                                ...operation,
                                durationMinutes,
                                label,
                            };
                        })
                        .sort((left, right) =>
                            left.label.localeCompare(right.label, undefined, {
                                numeric: true,
                            }),
                        );

                    const totalDuration = dayOperations.reduce(
                        (sum, operation) => sum + operation.durationMinutes,
                        0,
                    );

                    return (
                        <Stack key={key} spacing={2}>
                            <Row
                                spacing={2}
                                className="items-center flex-wrap gap-y-1"
                            >
                                {physicalId ? (
                                    <RaisedBedLabel physicalId={physicalId} />
                                ) : (
                                    <Typography semiBold>
                                        Gredica bez fizičkog ID-a
                                    </Typography>
                                )}
                                <Typography
                                    level="body2"
                                    className="text-muted-foreground"
                                >
                                    {dayOperations.length} zadataka
                                </Typography>
                                {totalDuration > 0 && (
                                    <Typography
                                        level="body2"
                                        className="text-muted-foreground"
                                    >
                                        Vrijeme: {formatMinutes(totalDuration)}
                                    </Typography>
                                )}
                            </Row>
                            <Stack spacing={2}>
                                {dayOperations.map((operation) => {
                                    const completed = isOperationCompleted(
                                        operation.status,
                                    );
                                    const operationData = operationDataById.get(
                                        operation.entityId,
                                    );
                                    const canComplete =
                                        !completed &&
                                        (!operation.assignedUserId ||
                                            operation.assignedUserId ===
                                                userId);
                                    const harvestLabelData =
                                        shouldPrintOperationLabel(operationData)
                                            ? buildHarvestLabelData(
                                                  operation,
                                                  groupedRaisedBeds,
                                                  plantSortById,
                                                  getOperationDetailLabel(
                                                      operation,
                                                      operationData,
                                                  ),
                                              )
                                            : null;
                                    const attachImages = Boolean(
                                        operationData?.conditions
                                            ?.completionAttachImages ||
                                            operationData?.conditions
                                                ?.completionAttachImagesRequired,
                                    );
                                    const attachImagesRequired = Boolean(
                                        operationData?.conditions
                                            ?.completionAttachImagesRequired,
                                    );
                                    const attachNotes = Boolean(
                                        operationData?.conditions
                                            ?.completionAttachNotes ||
                                            operationData?.conditions
                                                ?.completionAttachNotesRequired,
                                    );
                                    const attachNotesRequired = Boolean(
                                        operationData?.conditions
                                            ?.completionAttachNotesRequired,
                                    );
                                    const completionRequirementTexts = [
                                        attachImages
                                            ? attachImagesRequired
                                                ? 'Slike obavezne'
                                                : 'Slike opcionalne'
                                            : null,
                                        attachNotes
                                            ? attachNotesRequired
                                                ? 'Napomena obavezna'
                                                : 'Napomena opcionalna'
                                            : null,
                                    ].filter((text): text is string =>
                                        Boolean(text),
                                    );

                                    return (
                                        <div
                                            key={operation.id}
                                            className="rounded-lg border bg-white px-3 py-2"
                                        >
                                            <Row
                                                spacing={2}
                                                className="min-w-0 items-start justify-between gap-3"
                                            >
                                                <Row
                                                    spacing={2}
                                                    className="min-w-0 grow items-start"
                                                >
                                                    {completed ? (
                                                        <Checkbox
                                                            className="size-5"
                                                            checked
                                                            disabled
                                                        />
                                                    ) : canComplete ? (
                                                        <CompleteOperationModal
                                                            operationId={
                                                                operation.id
                                                            }
                                                            label={
                                                                operation.label
                                                            }
                                                            conditions={
                                                                operationDataById.get(
                                                                    operation.entityId,
                                                                )?.conditions
                                                            }
                                                        />
                                                    ) : (
                                                        <div title="Radnja je dodijeljena drugom korisniku.">
                                                            <Checkbox
                                                                className="size-5"
                                                                disabled
                                                            />
                                                        </div>
                                                    )}
                                                    <Stack
                                                        spacing={1}
                                                        className="min-w-0 grow"
                                                    >
                                                        <Typography
                                                            className={
                                                                completed
                                                                    ? 'line-through text-muted-foreground [overflow-wrap:anywhere]'
                                                                    : '[overflow-wrap:anywhere]'
                                                            }
                                                        >
                                                            {operation.label}
                                                        </Typography>
                                                        <Row
                                                            spacing={2}
                                                            className="items-center flex-wrap gap-y-1"
                                                        >
                                                            <Typography
                                                                level="body2"
                                                                className={
                                                                    completed
                                                                        ? 'text-green-600'
                                                                        : 'text-muted-foreground'
                                                                }
                                                            >
                                                                {completed
                                                                    ? 'Završeno'
                                                                    : 'Potvrđeno'}
                                                            </Typography>
                                                            {operation.durationMinutes >
                                                                0 && (
                                                                <Typography
                                                                    level="body2"
                                                                    className="text-muted-foreground"
                                                                >
                                                                    {formatMinutes(
                                                                        operation.durationMinutes,
                                                                    )}
                                                                </Typography>
                                                            )}
                                                            <Typography
                                                                level="body2"
                                                                className="text-muted-foreground"
                                                            >
                                                                {operation.scheduledDate ? (
                                                                    <>
                                                                        Planirano:{' '}
                                                                        <LocalDateTime
                                                                            time={
                                                                                false
                                                                            }
                                                                        >
                                                                            {
                                                                                operation.scheduledDate
                                                                            }
                                                                        </LocalDateTime>
                                                                    </>
                                                                ) : (
                                                                    'Danas'
                                                                )}
                                                            </Typography>
                                                            {!completed &&
                                                                completionRequirementTexts.length >
                                                                    0 && (
                                                                    <Typography
                                                                        level="body2"
                                                                        className="text-xs text-muted-foreground"
                                                                    >
                                                                        {completionRequirementTexts.join(
                                                                            ' · ',
                                                                        )}
                                                                    </Typography>
                                                                )}
                                                            {harvestLabelData && (
                                                                <FieldOperationPrintModal
                                                                    title="Ispis etikete za berbu"
                                                                    labelData={
                                                                        harvestLabelData
                                                                    }
                                                                    description={renderHarvestLabelDescription(
                                                                        operation.label,
                                                                        harvestLabelData,
                                                                    )}
                                                                />
                                                            )}
                                                        </Row>
                                                    </Stack>
                                                </Row>
                                                {(completed ||
                                                    operation.assignedUser) && (
                                                    <Row
                                                        spacing={1}
                                                        className="shrink-0 items-center"
                                                    >
                                                        {completed && (
                                                            <OperationCompletionAttachments
                                                                operationId={
                                                                    operation.id
                                                                }
                                                                notes={
                                                                    operation.completionNotes
                                                                }
                                                                imageUrls={
                                                                    operation.imageUrls
                                                                }
                                                            />
                                                        )}
                                                        {operation.assignedUser && (
                                                            <div
                                                                className="shrink-0"
                                                                title={`Dodijeljeno: ${operation.assignedUser.displayName ?? operation.assignedUser.userName}`}
                                                            >
                                                                <UserAvatar
                                                                    avatarUrl={
                                                                        operation
                                                                            .assignedUser
                                                                            .avatarUrl
                                                                    }
                                                                    displayName={
                                                                        operation
                                                                            .assignedUser
                                                                            .displayName ??
                                                                        operation
                                                                            .assignedUser
                                                                            .userName
                                                                    }
                                                                    className="size-7 rounded-full"
                                                                />
                                                            </div>
                                                        )}
                                                    </Row>
                                                )}
                                            </Row>
                                        </div>
                                    );
                                })}
                            </Stack>
                        </Stack>
                    );
                },
            )}
        </Stack>
    );
}
