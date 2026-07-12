'use client';

import { calculatePlantsPerField, FIELD_SIZE_CM } from '@gredice/js/plants';
import type { RaisedBedFieldAssignableFarmUser } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Checkbox } from '@gredice/ui/Checkbox';
import { Chip } from '@gredice/ui/Chip';
import { IconButton } from '@gredice/ui/IconButton';
import { Calendar, Close, ToggleLeft, ToggleRight } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { RaisedBedIcon } from '@gredice/ui/RaisedBedIcon';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';
import { KnownPages } from '../../../src/KnownPages';
import {
    acceptRaisedBedFieldAction,
    assignRaisedBedFieldUserAction,
    cancelRaisedBedFieldAction,
    raisedBedPlanted,
    rescheduleRaisedBedFieldAction,
    setRaisedBedFieldSowingLocationAction,
    verifyRaisedBedPlantingAction,
} from '../../(actions)/raisedBedFieldsActions';
import { AcceptRaisedBedFieldModal } from './AcceptRaisedBedFieldModal';
import { AssignRaisedBedFieldModal } from './AssignRaisedBedFieldModal';
import { BulkApproveRaisedBedButton } from './BulkApproveRaisedBedButton';
import { BulkAssignRaisedBedButton } from './BulkAssignRaisedBedButton';
import {
    BulkCancelRaisedBedButton,
    buildFieldCancelFormData,
} from './BulkCancelRaisedBedButton';
import { BulkRescheduleRaisedBedButton } from './BulkRescheduleRaisedBedButton';
import { CancelRaisedBedFieldModal } from './CancelRaisedBedFieldModal';
import { CompletePlantingModal } from './CompletePlantingModal';
import { CopyTasksButton } from './CopyTasksButton';
import { RescheduleRaisedBedFieldModal } from './RescheduleRaisedBedFieldModal';
import { SchedulePlantVisual } from './ScheduleTaskVisual';
import { parseScheduledDateInput } from './scheduleOptimisticHelpers';
import {
    formatMinutes,
    getScheduleTaskRowClassName,
    isFieldApproved,
    isFieldCompleted,
    isFieldPendingVerification,
    isSameScheduleDay,
    PLANTING_TASK_DURATION_MINUTES,
} from './scheduleShared';
import type { RaisedBed, RaisedBedField } from './types';
import { useOptimisticScheduleActions } from './useOptimisticScheduleActions';
import { VerifyPlantingModal } from './VerifyPlantingModal';

interface RaisedBedPlantingScheduleSectionProps {
    dateKey: string;
    timeZone: string;
    physicalId: string;
    raisedBeds: RaisedBed[];
    scheduledFields: RaisedBedField[];
    plantSorts: EntityStandardized[] | null | undefined;
    assignableFarmUsersByRaisedBedFieldId: Record<
        number,
        RaisedBedFieldAssignableFarmUser[]
    >;
}

function getSowingTaskName(sowingLocation?: RaisedBedField['sowingLocation']) {
    return sowingLocation === 'greenhouse' ? 'sijanje u stakleniku' : 'sijanje';
}

function getSowingTaskLabel({
    physicalPositionIndex,
    plantName,
    sowingLocation,
    totalPlants,
}: {
    physicalPositionIndex: number;
    plantName: string;
    sowingLocation?: RaisedBedField['sowingLocation'];
    totalPlants: number;
}) {
    return `${physicalPositionIndex} - ${getSowingTaskName(sowingLocation)}: ${totalPlants} ${plantName}`;
}

export function RaisedBedPlantingScheduleSection({
    dateKey,
    timeZone,
    physicalId,
    raisedBeds,
    scheduledFields,
    plantSorts,
    assignableFarmUsersByRaisedBedFieldId,
}: RaisedBedPlantingScheduleSectionProps) {
    const { getFieldPatch, runOptimisticAction } =
        useOptimisticScheduleActions();

    if (raisedBeds.length === 0) {
        return null;
    }

    const sortedRaisedBeds = [...raisedBeds].sort((a, b) => a.id - b.id);
    const firstRaisedBed = sortedRaisedBeds.at(0);
    const raisedBedDetailsLink = firstRaisedBed
        ? KnownPages.RaisedBed(firstRaisedBed.id)
        : null;

    const dayFields = scheduledFields
        .filter((field) =>
            sortedRaisedBeds.some(
                (raisedBed) => raisedBed.id === field.raisedBedId,
            ),
        )
        .map((field) => {
            const optimisticPatch = getFieldPatch(field.id);
            return {
                ...field,
                ...optimisticPatch,
                physicalPositionIndex: sortedRaisedBeds
                    .at(0)
                    ?.fields.find(
                        (raisedBedField) => raisedBedField.id === field.id,
                    )
                    ? field.positionIndex + 1
                    : field.positionIndex + 10,
            };
        })
        .filter((field) => !field.isDeleted)
        .sort((a, b) => a.physicalPositionIndex - b.physicalPositionIndex);

    const copyTasks = dayFields.map((field) => {
        const sortData = plantSorts?.find(
            (plantSort) => plantSort.id === field.plantSortId,
        );
        const { totalPlants } = calculatePlantsPerField(
            sortData?.information?.plant?.attributes?.seedingDistance,
        );

        return {
            id: `field-${field.id}`,
            text: getSowingTaskLabel({
                physicalPositionIndex: field.physicalPositionIndex,
                plantName: field.plantSortId
                    ? (sortData?.information?.name ?? '?')
                    : '?',
                sowingLocation: field.sowingLocation,
                totalPlants,
            }),
            approved:
                isFieldApproved(field.plantStatus) &&
                !isFieldPendingVerification(field.plantStatus) &&
                !isFieldCompleted(field.plantStatus),
        };
    });

    const fieldsToApprove = dayFields
        .filter(
            (field) =>
                !isFieldApproved(field.plantStatus) &&
                !isFieldPendingVerification(field.plantStatus) &&
                !isFieldCompleted(field.plantStatus) &&
                !!field.assignedUserId,
        )
        .map((field) => {
            const sortData = plantSorts?.find(
                (plantSort) => plantSort.id === field.plantSortId,
            );
            const numberOfPlants =
                Math.floor(
                    FIELD_SIZE_CM /
                        (sortData?.information?.plant?.attributes
                            ?.seedingDistance || FIELD_SIZE_CM),
                ) ** 2;

            return {
                id: field.id,
                raisedBedId: field.raisedBedId,
                positionIndex: field.positionIndex,
                label: getSowingTaskLabel({
                    physicalPositionIndex: field.physicalPositionIndex,
                    plantName: field.plantSortId
                        ? (sortData?.information?.name ?? 'Nepoznato')
                        : 'Nepoznato',
                    sowingLocation: field.sowingLocation,
                    totalPlants: numberOfPlants,
                }),
            };
        });
    const fieldsToReschedule = dayFields
        .filter(
            (field) =>
                !isFieldApproved(field.plantStatus) &&
                !isFieldPendingVerification(field.plantStatus) &&
                !isFieldCompleted(field.plantStatus),
        )
        .map((field) => ({
            id: field.id,
            raisedBedId: field.raisedBedId,
            positionIndex: field.positionIndex,
        }));
    const fieldsToAssign = dayFields
        .filter(
            (field) =>
                !isFieldCompleted(field.plantStatus) &&
                !isFieldPendingVerification(field.plantStatus),
        )
        .map((field) => ({
            id: field.id,
            farmUsers: assignableFarmUsersByRaisedBedFieldId[field.id] ?? [],
        }));
    const fieldsToCancel = dayFields
        .filter(
            (field) =>
                !isFieldCompleted(field.plantStatus) &&
                !isFieldPendingVerification(field.plantStatus),
        )
        .map((field) => ({
            id: field.id,
            raisedBedId: field.raisedBedId,
            positionIndex: field.positionIndex,
            label: `${field.positionIndex + 1}`,
        }));

    const durations = dayFields.reduce(
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

    return (
        <Stack key={physicalId} spacing={2}>
            <Row spacing={2} className="w-full items-center flex-wrap gap-y-1">
                <Row
                    spacing={1}
                    className="min-w-0 grow items-center flex-wrap gap-y-1"
                >
                    {raisedBedDetailsLink ? (
                        <Link
                            href={raisedBedDetailsLink}
                            aria-label={`Gredica ${physicalId}`}
                        >
                            <RaisedBedIcon
                                physicalId={physicalId}
                                className="size-5"
                                containerClassName="h-5"
                            />
                        </Link>
                    ) : (
                        <RaisedBedIcon
                            physicalId={physicalId}
                            className="size-5"
                            containerClassName="h-5"
                        />
                    )}
                    <Typography level="body2" className="text-muted-foreground">
                        {formatMinutes(durations.completed, true)} /{' '}
                        {formatMinutes(durations.approved)} (
                        {formatMinutes(durations.total)})
                    </Typography>
                </Row>
                <Row spacing={1} className="ml-auto shrink-0 items-center">
                    <BulkApproveRaisedBedButton
                        physicalId={physicalId.toString()}
                        fields={fieldsToApprove}
                        operations={[]}
                        onConfirm={() =>
                            runOptimisticAction({
                                fieldPatches: fieldsToApprove.map((field) => ({
                                    id: field.id,
                                    patch: { plantStatus: 'planned' },
                                })),
                                action: () =>
                                    Promise.all(
                                        fieldsToApprove.map((field) =>
                                            acceptRaisedBedFieldAction(
                                                field.raisedBedId,
                                                field.positionIndex,
                                            ),
                                        ),
                                    ),
                                errorLogMessage:
                                    'Failed to approve all raised bed planting items:',
                                errorAlertMessage:
                                    'Skupna potvrda sijanja nije uspjela. Promjena je vraćena.',
                            })
                        }
                    />
                    <CopyTasksButton
                        physicalId={physicalId.toString()}
                        tasks={copyTasks}
                    />
                    <BulkAssignRaisedBedButton
                        physicalId={physicalId.toString()}
                        fields={fieldsToAssign}
                        operations={[]}
                        onSubmit={(assignedUserIds) =>
                            runOptimisticAction({
                                fieldPatches: fieldsToAssign.map((field) => ({
                                    id: field.id,
                                    patch: {
                                        assignedUserId:
                                            assignedUserIds[0] ?? null,
                                        assignedUserIds,
                                    },
                                })),
                                action: () =>
                                    Promise.all(
                                        fieldsToAssign.map((field) =>
                                            assignRaisedBedFieldUserAction(
                                                field.id,
                                                assignedUserIds,
                                            ),
                                        ),
                                    ),
                                errorLogMessage:
                                    'Failed to assign users for all raised bed planting items:',
                                errorAlertMessage:
                                    'Skupna dodjela sijanja nije uspjela. Promjena je vraćena.',
                            })
                        }
                    />
                    <BulkRescheduleRaisedBedButton
                        physicalId={physicalId.toString()}
                        fields={fieldsToReschedule}
                        operations={[]}
                        onSubmit={(scheduledDate) =>
                            runOptimisticAction({
                                fieldPatches: fieldsToReschedule.map(
                                    (field) => ({
                                        id: field.id,
                                        patch: {
                                            plantScheduledDate:
                                                parseScheduledDateInput(
                                                    scheduledDate,
                                                ),
                                        },
                                    }),
                                ),
                                action: () =>
                                    Promise.all(
                                        fieldsToReschedule.map((field) => {
                                            const formData = new FormData();
                                            formData.set(
                                                'raisedBedId',
                                                field.raisedBedId.toString(),
                                            );
                                            formData.set(
                                                'positionIndex',
                                                field.positionIndex.toString(),
                                            );
                                            formData.set(
                                                'scheduledDate',
                                                scheduledDate,
                                            );
                                            return rescheduleRaisedBedFieldAction(
                                                formData,
                                            );
                                        }),
                                    ),
                                errorLogMessage:
                                    'Failed to reschedule all raised bed planting items:',
                                errorAlertMessage:
                                    'Skupno zakazivanje sijanja nije uspjelo. Promjena je vraćena.',
                            })
                        }
                    />
                    <BulkCancelRaisedBedButton
                        physicalId={physicalId.toString()}
                        fields={fieldsToCancel}
                        operations={[]}
                        onSubmit={(formData) =>
                            runOptimisticAction({
                                fieldPatches: fieldsToCancel.map((field) => ({
                                    id: field.id,
                                    patch: { isDeleted: true },
                                })),
                                action: () =>
                                    Promise.all(
                                        fieldsToCancel.map((field) =>
                                            cancelRaisedBedFieldAction(
                                                buildFieldCancelFormData(
                                                    field,
                                                    formData,
                                                ),
                                            ),
                                        ),
                                    ),
                                errorLogMessage:
                                    'Failed to cancel all raised bed planting items:',
                                errorAlertMessage:
                                    'Skupno otkazivanje sijanja nije uspjelo. Promjena je vraćena.',
                            })
                        }
                    />
                </Row>
            </Row>
            <Stack spacing={0}>
                {!dayFields.length && (
                    <Typography level="body2">
                        Trenutno nema sijanja za ovu gredicu.
                    </Typography>
                )}
                {dayFields.map((field) => {
                    const sortData = plantSorts?.find(
                        (plantSort) => plantSort.id === field.plantSortId,
                    );
                    const numberOfPlants =
                        Math.floor(
                            FIELD_SIZE_CM /
                                (sortData?.information?.plant?.attributes
                                    ?.seedingDistance || FIELD_SIZE_CM),
                        ) ** 2;

                    const handlePlantConfirm = async () => {
                        const plantSortId = field.plantSortId;
                        if (!plantSortId) return;
                        runOptimisticAction({
                            fieldPatches: [
                                {
                                    id: field.id,
                                    patch: { plantStatus: 'sowed' },
                                },
                            ],
                            action: () =>
                                raisedBedPlanted(
                                    field.raisedBedId,
                                    field.positionIndex,
                                    plantSortId,
                                ),
                            errorLogMessage: 'Error completing planting:',
                            errorAlertMessage:
                                'Završetak sijanja nije uspio. Promjena je vraćena.',
                        });
                    };

                    const fieldLabel = getSowingTaskLabel({
                        physicalPositionIndex: field.physicalPositionIndex,
                        plantName: field.plantSortId
                            ? (sortData?.information?.name ?? 'Nepoznato')
                            : 'Nepoznato',
                        sowingLocation: field.sowingLocation,
                        totalPlants: numberOfPlants,
                    });
                    const fieldStatus = field.plantStatus;
                    const fieldCompleted = isFieldCompleted(fieldStatus);
                    const fieldPendingVerification =
                        isFieldPendingVerification(fieldStatus);
                    const fieldApproved = isFieldApproved(fieldStatus);
                    const greenhouseSowing =
                        field.sowingLocation === 'greenhouse';
                    const nextSowingLocation = greenhouseSowing
                        ? 'direct'
                        : 'greenhouse';
                    const fieldStatusText = fieldPendingVerification
                        ? 'Čeka verifikaciju'
                        : fieldApproved || fieldCompleted
                          ? null
                          : 'Nije potvrđeno';
                    const fieldStatusClassName = fieldCompleted
                        ? 'text-green-600'
                        : fieldPendingVerification
                          ? 'text-amber-600'
                          : fieldApproved
                            ? 'text-green-600'
                            : 'text-muted-foreground';
                    const fieldLocked =
                        fieldCompleted || fieldPendingVerification;
                    const fieldApprovedActive = fieldApproved && !fieldLocked;
                    const fieldPendingAcceptance =
                        !fieldApproved && !fieldLocked;
                    const showScheduledDate =
                        !!field.plantScheduledDate &&
                        !isSameScheduleDay(
                            field.plantScheduledDate,
                            dateKey,
                            timeZone,
                        );

                    return (
                        <div key={field.id}>
                            <Row
                                spacing={1}
                                className={getScheduleTaskRowClassName({
                                    accepted: fieldApprovedActive,
                                    pendingAcceptance: fieldPendingAcceptance,
                                })}
                            >
                                <Row className="min-w-0 flex-1 flex-nowrap gap-1 md:gap-2">
                                    {fieldCompleted ? (
                                        <Checkbox checked disabled />
                                    ) : fieldPendingVerification ? (
                                        <VerifyPlantingModal
                                            raisedBedId={field.raisedBedId}
                                            positionIndex={field.positionIndex}
                                            label={fieldLabel}
                                            onConfirm={() =>
                                                runOptimisticAction({
                                                    fieldPatches: [
                                                        {
                                                            id: field.id,
                                                            patch: {
                                                                plantStatus:
                                                                    'sowed',
                                                            },
                                                        },
                                                    ],
                                                    action: () =>
                                                        verifyRaisedBedPlantingAction(
                                                            field.raisedBedId,
                                                            field.positionIndex,
                                                        ),
                                                    errorLogMessage:
                                                        'Error verifying planting:',
                                                    errorAlertMessage:
                                                        'Verifikacija sijanja nije uspjela. Promjena je vraćena.',
                                                })
                                            }
                                        />
                                    ) : field.plantSortId && !fieldApproved ? (
                                        <AcceptRaisedBedFieldModal
                                            raisedBedId={field.raisedBedId}
                                            positionIndex={field.positionIndex}
                                            label={fieldLabel}
                                            raisedBedPhysicalId={physicalId}
                                            disabled={!field.assignedUserId}
                                            onConfirm={() =>
                                                runOptimisticAction({
                                                    fieldPatches: [
                                                        {
                                                            id: field.id,
                                                            patch: {
                                                                plantStatus:
                                                                    'planned',
                                                            },
                                                        },
                                                    ],
                                                    action: () =>
                                                        acceptRaisedBedFieldAction(
                                                            field.raisedBedId,
                                                            field.positionIndex,
                                                        ),
                                                    errorLogMessage:
                                                        'Error accepting field request:',
                                                    errorAlertMessage:
                                                        'Potvrda sijanja nije uspjela. Promjena je vraćena.',
                                                })
                                            }
                                        />
                                    ) : (
                                        <CompletePlantingModal
                                            label={fieldLabel}
                                            raisedBedPhysicalId={physicalId}
                                            onConfirm={handlePlantConfirm}
                                        />
                                    )}
                                    <SchedulePlantVisual
                                        plantSort={sortData}
                                        label={fieldLabel}
                                    />
                                    <Typography
                                        level="body1"
                                        noWrap
                                        className={
                                            fieldCompleted
                                                ? 'min-w-0 flex-1 line-through text-muted-foreground'
                                                : 'min-w-0 flex-1'
                                        }
                                    >
                                        {fieldLabel}
                                    </Typography>
                                    {fieldStatusText && (
                                        <Typography
                                            level="body2"
                                            className={`shrink-0 italic ${fieldStatusClassName}`}
                                        >
                                            {fieldStatusText}
                                        </Typography>
                                    )}
                                    {(showScheduledDate ||
                                        !field.plantScheduledDate) && (
                                        <Typography
                                            level="body2"
                                            component="div"
                                            className="shrink-0 select-none"
                                        >
                                            {showScheduledDate ? (
                                                <LocalDateTime
                                                    time={false}
                                                    format={{
                                                        year: 'numeric',
                                                        month: 'numeric',
                                                        day: 'numeric',
                                                        timeZone,
                                                    }}
                                                >
                                                    {field.plantScheduledDate}
                                                </LocalDateTime>
                                            ) : (
                                                <Chip
                                                    size="sm"
                                                    color="warning"
                                                    className="w-fit"
                                                >
                                                    Nije planirano
                                                </Chip>
                                            )}
                                        </Typography>
                                    )}
                                    <Button
                                        variant={
                                            greenhouseSowing
                                                ? 'soft'
                                                : 'outlined'
                                        }
                                        color={
                                            greenhouseSowing
                                                ? 'success'
                                                : 'neutral'
                                        }
                                        size="xs"
                                        className="shrink-0"
                                        title={
                                            greenhouseSowing
                                                ? 'Označeno za sijanje u stakleniku'
                                                : 'Označi za sijanje u stakleniku'
                                        }
                                        startDecorator={
                                            greenhouseSowing ? (
                                                <ToggleRight className="size-4 shrink-0" />
                                            ) : (
                                                <ToggleLeft className="size-4 shrink-0" />
                                            )
                                        }
                                        onClick={() =>
                                            runOptimisticAction({
                                                fieldPatches: [
                                                    {
                                                        id: field.id,
                                                        patch: {
                                                            sowingLocation:
                                                                nextSowingLocation,
                                                        },
                                                    },
                                                ],
                                                action: () =>
                                                    setRaisedBedFieldSowingLocationAction(
                                                        field.raisedBedId,
                                                        field.positionIndex,
                                                        nextSowingLocation,
                                                    ),
                                                errorLogMessage:
                                                    'Error updating sowing location:',
                                                errorAlertMessage:
                                                    'Promjena lokacije sijanja nije uspjela. Promjena je vraćena.',
                                            })
                                        }
                                    >
                                        {greenhouseSowing
                                            ? 'Staklenik'
                                            : 'Direktno'}
                                    </Button>
                                </Row>
                                <Row spacing={0} className="ml-auto shrink-0">
                                    <AssignRaisedBedFieldModal
                                        raisedBedFieldId={field.id}
                                        label={fieldLabel}
                                        farmUsers={
                                            assignableFarmUsersByRaisedBedFieldId[
                                                field.id
                                            ] ?? []
                                        }
                                        assignedUserIds={field.assignedUserIds}
                                        disabled={fieldLocked}
                                        onSubmit={(assignedUserIds) =>
                                            runOptimisticAction({
                                                fieldPatches: [
                                                    {
                                                        id: field.id,
                                                        patch: {
                                                            assignedUserId:
                                                                assignedUserIds[0] ??
                                                                null,
                                                            assignedUserIds,
                                                        },
                                                    },
                                                ],
                                                action: () =>
                                                    assignRaisedBedFieldUserAction(
                                                        field.id,
                                                        assignedUserIds,
                                                    ),
                                                errorLogMessage:
                                                    'Error assigning planting user:',
                                                errorAlertMessage:
                                                    'Dodjela sijanja nije uspjela. Promjena je vraćena.',
                                            })
                                        }
                                    />
                                    <RescheduleRaisedBedFieldModal
                                        field={{
                                            raisedBedId: field.raisedBedId,
                                            positionIndex: field.positionIndex,
                                            plantScheduledDate:
                                                field.plantScheduledDate,
                                        }}
                                        fieldLabel={
                                            sortData?.information?.name ??
                                            field.plantSortId?.toString() ??
                                            '?'
                                        }
                                        onSubmit={(formData) => {
                                            const scheduledDate =
                                                formData.get('scheduledDate');
                                            runOptimisticAction({
                                                fieldPatches: [
                                                    {
                                                        id: field.id,
                                                        patch: {
                                                            plantScheduledDate:
                                                                typeof scheduledDate ===
                                                                'string'
                                                                    ? parseScheduledDateInput(
                                                                          scheduledDate,
                                                                      )
                                                                    : undefined,
                                                        },
                                                    },
                                                ],
                                                action: () =>
                                                    rescheduleRaisedBedFieldAction(
                                                        formData,
                                                    ),
                                                errorLogMessage:
                                                    'Error rescheduling planting:',
                                                errorAlertMessage:
                                                    'Zakazivanje sijanja nije uspjelo. Promjena je vraćena.',
                                            });
                                        }}
                                        trigger={
                                            <IconButton
                                                variant="plain"
                                                size="xs"
                                                title={
                                                    field.plantScheduledDate
                                                        ? 'Prerasporedi sijanje'
                                                        : 'Zakaži sijanje'
                                                }
                                                disabled={fieldLocked}
                                            >
                                                <Calendar className="size-4 shrink-0" />
                                            </IconButton>
                                        }
                                    />
                                    <CancelRaisedBedFieldModal
                                        field={{
                                            raisedBedId: field.raisedBedId,
                                            positionIndex: field.positionIndex,
                                        }}
                                        fieldLabel={fieldLabel}
                                        onSubmit={(formData) =>
                                            runOptimisticAction({
                                                fieldPatches: [
                                                    {
                                                        id: field.id,
                                                        patch: {
                                                            isDeleted: true,
                                                        },
                                                    },
                                                ],
                                                action: () =>
                                                    cancelRaisedBedFieldAction(
                                                        formData,
                                                    ),
                                                errorLogMessage:
                                                    'Error canceling planting:',
                                                errorAlertMessage:
                                                    'Otkazivanje sijanja nije uspjelo. Promjena je vraćena.',
                                            })
                                        }
                                        trigger={
                                            <IconButton
                                                variant="plain"
                                                size="xs"
                                                title="Otkaži sijanje"
                                                disabled={fieldLocked}
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
