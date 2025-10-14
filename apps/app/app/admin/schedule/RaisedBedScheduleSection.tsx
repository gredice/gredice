import { calculatePlantsPerField, FIELD_SIZE_CM } from '@gredice/js/plants';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
import { ModalConfirm } from '@signalco/ui/ModalConfirm';
import { Calendar, Close } from '@signalco/ui-icons';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';
import { KnownPages } from '../../../src/KnownPages';
import { raisedBedPlanted } from '../../(actions)/raisedBedFieldsActions';
import { AcceptOperationModal } from './AcceptOperationModal';
import { AcceptRaisedBedFieldModal } from './AcceptRaisedBedFieldModal';
import { BulkApproveRaisedBedButton } from './BulkApproveRaisedBedButton';
import { CancelOperationModal } from './CancelOperationModal';
import { CancelRaisedBedFieldModal } from './CancelRaisedBedFieldModal';
import { CompleteOperationModal } from './CompleteOperationModal';
import { CopyTasksButton } from './CopyTasksButton';
import { RescheduleOperationModal } from './RescheduleOperationModal';
import { RescheduleRaisedBedFieldModal } from './RescheduleRaisedBedFieldModal';
import {
    formatMinutes,
    getOperationDurationMinutes,
    isFieldApproved,
    isFieldCompleted,
    isOperationCancelled,
    isOperationCompleted,
    PLANTING_TASK_DURATION_MINUTES,
} from './scheduleShared';
import type { Operation, RaisedBed, RaisedBedField } from './types';

interface RaisedBedScheduleSectionProps {
    physicalId: string;
    raisedBeds: RaisedBed[];
    scheduledFields: RaisedBedField[];
    scheduledOperations: Operation[];
    plantSorts: EntityStandardized[] | null | undefined;
    operationDataById: Map<number, EntityStandardized>;
    userId: string;
}

export function RaisedBedScheduleSection({
    physicalId,
    raisedBeds,
    scheduledFields,
    scheduledOperations,
    plantSorts,
    operationDataById,
    userId,
}: RaisedBedScheduleSectionProps) {
    if (raisedBeds.length === 0) {
        return null;
    }

    const sortedRaisedBeds = [...raisedBeds].sort((a, b) => a.id - b.id);

    const dayFields = scheduledFields
        .filter((field) =>
            sortedRaisedBeds.some((rb) => rb.id === field.raisedBedId),
        )
        .map((field) => ({
            ...field,
            physicalPositionIndex: sortedRaisedBeds
                .at(0)
                ?.fields.find((f) => f.id === field.id)
                ? field.positionIndex + 1
                : field.positionIndex + 10,
        }))
        .sort((a, b) => a.physicalPositionIndex - b.physicalPositionIndex);

    const dayOperations = scheduledOperations
        .filter(
            (op) =>
                op.raisedBedId !== null &&
                sortedRaisedBeds.some((rb) => rb.id === op.raisedBedId),
        )
        .map((op) => {
            const isFirstRaisedBed =
                op.raisedBedId === sortedRaisedBeds.at(0)?.id;
            const field = op.raisedBedFieldId
                ? sortedRaisedBeds
                      .flatMap((rb) => rb.fields)
                      .find((rbf) => rbf.id === op.raisedBedFieldId)
                : undefined;
            const sort = field?.plantSortId
                ? plantSorts?.find((ps) => ps.id === field.plantSortId)
                : null;

            const physicalPositionIndex = field
                ? (isFirstRaisedBed
                      ? field.positionIndex + 1
                      : field.positionIndex + 10
                  ).toString()
                : isFirstRaisedBed
                  ? '1-9'
                  : '10-18';

            return {
                ...op,
                physicalPositionIndex,
                sort,
            };
        })
        .sort((a, b) =>
            a.physicalPositionIndex.localeCompare(
                b.physicalPositionIndex,
                undefined,
                {
                    numeric: true,
                },
            ),
        );

    const copyTasks = [
        ...dayFields.map((field) => {
            const sortData = plantSorts?.find(
                (ps) => ps.id === field.plantSortId,
            );
            const { totalPlants } = calculatePlantsPerField(
                sortData?.information?.plant?.attributes?.seedingDistance,
            );
            const status = field.plantStatus;
            return {
                id: `field-${field.id}`,
                text: `${field.physicalPositionIndex} - sijanje: ${totalPlants} ${field.plantSortId ? `${sortData?.information?.name}` : '?'}`,
                approved: isFieldApproved(status) && !isFieldCompleted(status),
            };
        }),
        ...dayOperations.map((op) => {
            const operationData = operationDataById.get(op.entityId);

            const isFullRaisedBed =
                operationData?.attributes?.application === 'raisedBedFull';
            const text = `${isFullRaisedBed ? '' : `${op.physicalPositionIndex} - `}${operationData?.information?.label ?? op.entityId}${op.sort ? `: ${op.sort.information?.name ?? 'Nepoznato'}` : ''}`;

            return {
                id: `operation-${op.id}`,
                text,
                link: operationData?.information?.label
                    ? KnownPages.GrediceOperation(
                          operationData?.information?.label,
                      )
                    : KnownPages.GrediceOperations,
                approved:
                    op.isAccepted &&
                    !isOperationCompleted(op.status) &&
                    !isOperationCancelled(op.status),
            };
        }),
    ];

    const fieldsToApprove = dayFields
        .filter(
            (field) =>
                !isFieldApproved(field.plantStatus) &&
                !isFieldCompleted(field.plantStatus),
        )
        .map((field) => {
            const sortData = plantSorts?.find(
                (ps) => ps.id === field.plantSortId,
            );
            const numberOfPlants =
                Math.floor(
                    FIELD_SIZE_CM /
                        (sortData?.information?.plant?.attributes
                            ?.seedingDistance || FIELD_SIZE_CM),
                ) ** 2;

            return {
                raisedBedId: field.raisedBedId,
                positionIndex: field.positionIndex,
                label: `${field.physicalPositionIndex} - sijanje: ${numberOfPlants} ${field.plantSortId ? `${sortData?.information?.name}` : 'Nepoznato'}`,
            };
        });

    const operationsToApprove = dayOperations
        .filter(
            (op) =>
                !op.isAccepted &&
                !isOperationCompleted(op.status) &&
                !isOperationCancelled(op.status),
        )
        .map((op) => {
            const operationData = operationDataById.get(op.entityId);
            const isFullRaisedBed =
                operationData?.attributes?.application === 'raisedBedFull';
            const label = `${isFullRaisedBed ? '' : `${op.physicalPositionIndex} - `}${operationData?.information?.label ?? op.entityId}${op.sort ? `: ${op.sort.information?.name ?? 'Nepoznato'}` : ''}`;

            return {
                id: op.id,
                label,
            };
        });

    const raisedBedFieldDurations = dayFields.reduce(
        (acc, field) => {
            acc.total += PLANTING_TASK_DURATION_MINUTES;
            if (isFieldApproved(field.plantStatus)) {
                acc.approved += PLANTING_TASK_DURATION_MINUTES;
            }
            if (isFieldCompleted(field.plantStatus)) {
                acc.completed += PLANTING_TASK_DURATION_MINUTES;
            }
            return acc;
        },
        { total: 0, approved: 0, completed: 0 },
    );

    const raisedBedOperationDurations = dayOperations.reduce(
        (acc, op) => {
            const duration = getOperationDurationMinutes(
                operationDataById.get(op.entityId),
            );
            acc.total += duration;
            if (isOperationCompleted(op.status)) {
                acc.completed += duration;
            }
            if (
                op.isAccepted &&
                !isOperationCompleted(op.status) &&
                !isOperationCancelled(op.status)
            ) {
                acc.approved += duration;
            }
            return acc;
        },
        { total: 0, approved: 0, completed: 0 },
    );

    const raisedBedTotalDuration =
        raisedBedFieldDurations.total + raisedBedOperationDurations.total;
    const raisedBedApprovedDuration =
        raisedBedFieldDurations.approved + raisedBedOperationDurations.approved;
    const raisedBedCompletedDuration =
        raisedBedFieldDurations.completed +
        raisedBedOperationDurations.completed;

    return (
        <Stack key={physicalId} spacing={1}>
            <Row spacing={0.5} className="items-center flex-wrap gap-y-1">
                <BulkApproveRaisedBedButton
                    physicalId={physicalId.toString()}
                    fields={fieldsToApprove}
                    operations={operationsToApprove}
                />
                <RaisedBedLabel physicalId={physicalId} />
                <Typography level="body2" className="text-muted-foreground">
                    Vrijeme: {formatMinutes(raisedBedCompletedDuration, true)} /{' '}
                    {formatMinutes(raisedBedApprovedDuration)} (
                    {formatMinutes(raisedBedTotalDuration)})
                </Typography>
                <CopyTasksButton
                    physicalId={physicalId.toString()}
                    tasks={copyTasks}
                />
            </Row>
            <Stack spacing={1}>
                {!dayFields.length && !dayOperations.length && (
                    <Typography level="body2">
                        Trenutno nema zadataka za ovu gredicu.
                    </Typography>
                )}
                {dayFields.map((field) => {
                    const sortData = plantSorts?.find(
                        (ps) => ps.id === field.plantSortId,
                    );
                    const numberOfPlants =
                        Math.floor(
                            FIELD_SIZE_CM /
                                (sortData?.information?.plant?.attributes
                                    ?.seedingDistance || FIELD_SIZE_CM),
                        ) ** 2;

                    const handlePlantConfirm = async () => {
                        if (!field.plantSortId) return;
                        await raisedBedPlanted(
                            field.raisedBedId,
                            field.positionIndex,
                            field.plantSortId,
                        );
                    };

                    const fieldLabel = `${field.physicalPositionIndex} - sijanje: ${numberOfPlants} ${field.plantSortId ? `${sortData?.information?.name}` : 'Nepoznato'}`;
                    const fieldStatus = field.plantStatus;
                    const fieldCompleted = isFieldCompleted(fieldStatus);
                    const fieldApproved = isFieldApproved(fieldStatus);
                    const fieldStatusText = fieldCompleted
                        ? 'Završeno'
                        : fieldApproved
                          ? 'Potvrđeno'
                          : 'Nije potvrđeno';
                    const fieldStatusClassName = fieldCompleted
                        ? 'text-green-600'
                        : fieldApproved
                          ? 'text-green-600'
                          : 'text-muted-foreground';

                    return (
                        <div key={field.id}>
                            <Row spacing={1} className="hover:bg-muted rounded">
                                <Row spacing={1} className="grow">
                                    {fieldApproved || fieldCompleted ? (
                                        fieldCompleted ? (
                                            <Checkbox
                                                className="size-5 mx-2"
                                                checked
                                                disabled
                                            />
                                        ) : (
                                            <Checkbox
                                                className="size-5 mx-2"
                                                checked
                                                disabled
                                            />
                                        )
                                    ) : field.plantSortId ? (
                                        <AcceptRaisedBedFieldModal
                                            raisedBedId={field.raisedBedId}
                                            positionIndex={field.positionIndex}
                                            label={fieldLabel}
                                        />
                                    ) : fieldCompleted ? (
                                        <Checkbox
                                            className="size-5 mx-2"
                                            checked
                                            disabled
                                        />
                                    ) : (
                                        <ModalConfirm
                                            title="Potvrda sijanja"
                                            header="Označavanje kao posijano"
                                            onConfirm={handlePlantConfirm}
                                            trigger={
                                                <Checkbox className="size-5 mx-2" />
                                            }
                                        >
                                            <Typography>
                                                Jeste li sigurni da želite
                                                označiti da je posijano:{' '}
                                                <strong>{fieldLabel}</strong>?
                                            </Typography>
                                        </ModalConfirm>
                                    )}
                                    <Typography
                                        className={
                                            fieldCompleted
                                                ? 'line-through text-muted-foreground'
                                                : undefined
                                        }
                                    >
                                        {fieldLabel}
                                    </Typography>
                                    <Typography
                                        level="body2"
                                        className={`ml-1 italic ${fieldStatusClassName}`}
                                    >
                                        {fieldStatusText}
                                    </Typography>
                                    <Typography
                                        level="body2"
                                        className="select-none"
                                    >
                                        {field.plantScheduledDate ? (
                                            <LocalDateTime time={false}>
                                                {field.plantScheduledDate}
                                            </LocalDateTime>
                                        ) : (
                                            <span>Danas</span>
                                        )}
                                    </Typography>
                                </Row>
                                <Row>
                                    <RescheduleRaisedBedFieldModal
                                        field={field}
                                        fieldLabel={fieldLabel}
                                        trigger={
                                            <IconButton
                                                variant="plain"
                                                title={
                                                    field.plantScheduledDate
                                                        ? 'Prerasporedi sijanje'
                                                        : 'Zakaži sijanje'
                                                }
                                                disabled={fieldCompleted}
                                            >
                                                <Calendar className="size-4 shrink-0" />
                                            </IconButton>
                                        }
                                    />
                                    <CancelRaisedBedFieldModal
                                        field={field}
                                        fieldLabel={fieldLabel}
                                        trigger={
                                            <IconButton
                                                variant="plain"
                                                title="Otkaži sijanje"
                                                disabled={fieldCompleted}
                                            >
                                                <Close className="size-4 shrink-0" />
                                            </IconButton>
                                        }
                                    />
                                </Row>
                            </Row>
                        </div>
                    );
                })}
                {dayOperations.map((op) => {
                    const operationData = operationDataById.get(op.entityId);
                    const isFullRaisedBed =
                        operationData?.attributes?.application ===
                        'raisedBedFull';
                    const operationLabel = `${isFullRaisedBed ? '' : `${op.physicalPositionIndex} - `}${operationData?.information?.label ?? op.entityId}${op.sort ? `: ${op.sort.information?.name ?? 'Nepoznato'}` : ''}`;
                    const operationCompleted = isOperationCompleted(op.status);
                    const operationCancelled = isOperationCancelled(op.status);
                    const operationStatusText = operationCancelled
                        ? 'Otkazano'
                        : operationCompleted
                          ? 'Završeno'
                          : op.isAccepted
                            ? 'Potvrđeno'
                            : 'Nije potvrđeno';
                    const operationStatusClassName = operationCancelled
                        ? 'text-red-600'
                        : operationCompleted
                          ? 'text-green-600'
                          : op.isAccepted
                            ? 'text-green-600'
                            : 'text-muted-foreground';
                    const operationInactive =
                        operationCompleted || operationCancelled;
                    return (
                        <div key={op.id}>
                            <Row spacing={1} className="hover:bg-muted rounded">
                                <Row spacing={1} className="grow">
                                    {operationCompleted ? (
                                        <Checkbox
                                            className="size-5 mx-2"
                                            checked
                                            disabled
                                        />
                                    ) : operationCancelled ? (
                                        <Checkbox
                                            className="size-5 mx-2"
                                            checked={false}
                                            disabled
                                        />
                                    ) : op.isAccepted ? (
                                        <CompleteOperationModal
                                            operationId={op.id}
                                            userId={userId}
                                            label={operationLabel}
                                            conditions={
                                                operationData?.conditions
                                            }
                                        />
                                    ) : (
                                        <AcceptOperationModal
                                            operationId={op.id}
                                            label={operationLabel}
                                        />
                                    )}
                                    <a
                                        href={
                                            operationData?.information?.label
                                                ? KnownPages.GrediceOperation(
                                                      operationData?.information
                                                          ?.label,
                                                  )
                                                : KnownPages.GrediceOperations
                                        }
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <Typography
                                            className={
                                                operationInactive
                                                    ? 'line-through text-muted-foreground'
                                                    : undefined
                                            }
                                        >
                                            {operationLabel}
                                        </Typography>
                                    </a>
                                    <Typography
                                        level="body2"
                                        className={`ml-1 italic ${operationStatusClassName}`}
                                    >
                                        {operationStatusText}
                                    </Typography>
                                    <Typography
                                        level="body2"
                                        className="select-none"
                                    >
                                        {op.scheduledDate ? (
                                            <LocalDateTime time={false}>
                                                {op.scheduledDate}
                                            </LocalDateTime>
                                        ) : (
                                            <span>Danas</span>
                                        )}
                                    </Typography>
                                </Row>
                                <Row>
                                    <RescheduleOperationModal
                                        operation={{
                                            id: op.id,
                                            entityId: op.entityId,
                                            scheduledDate: op.scheduledDate,
                                        }}
                                        operationLabel={
                                            operationData?.information?.label ??
                                            op.entityId.toString()
                                        }
                                        trigger={
                                            <IconButton
                                                variant="plain"
                                                title={
                                                    op.scheduledDate
                                                        ? 'Prerasporedi operaciju'
                                                        : 'Zakaži operaciju'
                                                }
                                                disabled={operationInactive}
                                            >
                                                <Calendar className="size-4 shrink-0" />
                                            </IconButton>
                                        }
                                    />
                                    <CancelOperationModal
                                        operation={{
                                            id: op.id,
                                            entityId: op.entityId,
                                            scheduledDate: op.scheduledDate,
                                            status: op.status,
                                        }}
                                        operationLabel={
                                            operationData?.information?.label ??
                                            op.entityId.toString()
                                        }
                                        trigger={
                                            <IconButton
                                                variant="plain"
                                                title="Otkaži operaciju"
                                                disabled={operationInactive}
                                            >
                                                <Close className="size-4 shrink-0" />
                                            </IconButton>
                                        }
                                    />
                                </Row>
                            </Row>
                        </div>
                    );
                })}
            </Stack>
        </Stack>
    );
}
