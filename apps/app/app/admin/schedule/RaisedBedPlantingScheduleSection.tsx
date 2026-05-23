'use client';

import { calculatePlantsPerField, FIELD_SIZE_CM } from '@gredice/js/plants';
import type { RaisedBedFieldAssignableFarmUser } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Checkbox } from '@gredice/ui/Checkbox';
import { Chip } from '@gredice/ui/Chip';
import { IconButton } from '@gredice/ui/IconButton';
import { Calendar, Close, ToggleLeft, ToggleRight } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
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
import { BulkRescheduleRaisedBedButton } from './BulkRescheduleRaisedBedButton';
import { CancelRaisedBedFieldModal } from './CancelRaisedBedFieldModal';
import { CompletePlantingModal } from './CompletePlantingModal';
import { CopyTasksButton } from './CopyTasksButton';
import { RescheduleRaisedBedFieldModal } from './RescheduleRaisedBedFieldModal';
import { parseScheduledDateInput } from './scheduleOptimisticHelpers';
import {
    formatMinutes,
    isFieldApproved,
    isFieldCompleted,
    isFieldPendingVerification,
    PLANTING_TASK_DURATION_MINUTES,
} from './scheduleShared';
import type { RaisedBed, RaisedBedField } from './types';
import { useOptimisticScheduleActions } from './useOptimisticScheduleActions';
import { VerifyPlantingModal } from './VerifyPlantingModal';

interface RaisedBedPlantingScheduleSectionProps {
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
                <Row
                    spacing={1}
                    className="min-w-0 grow items-center flex-wrap gap-y-1"
                >
                    {raisedBedDetailsLink ? (
                        <Link href={raisedBedDetailsLink}>
                            <RaisedBedLabel physicalId={physicalId} />
                        </Link>
                    ) : (
                        <RaisedBedLabel physicalId={physicalId} />
                    )}
                    <Typography level="body2" className="text-muted-foreground">
                        Vrijeme: {formatMinutes(durations.completed, true)} /{' '}
                        {formatMinutes(durations.approved)} (
                        {formatMinutes(durations.total)})
                    </Typography>
                    <CopyTasksButton
                        physicalId={physicalId.toString()}
                        tasks={copyTasks}
                    />
                </Row>
                <Row spacing={1} className="ml-auto shrink-0 items-center">
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
                </Row>
            </Row>
            <Stack spacing={2}>
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
                    const fieldStatusText = fieldCompleted
                        ? 'Završeno'
                        : fieldPendingVerification
                          ? 'Čeka verifikaciju'
                          : fieldApproved
                            ? 'Potvrđeno'
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

                    return (
                        <div key={field.id}>
                            <Row
                                spacing={2}
                                className={
                                    fieldApprovedActive
                                        ? 'rounded bg-muted/60 text-foreground hover:bg-muted/80'
                                        : 'rounded hover:bg-muted'
                                }
                            >
                                <Row spacing={2} className="grow">
                                    {fieldCompleted ? (
                                        <Checkbox
                                            className="size-5 mx-2"
                                            checked
                                            disabled
                                        />
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
                                            onConfirm={handlePlantConfirm}
                                        />
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
                                        component="div"
                                        className="select-none"
                                    >
                                        {field.plantScheduledDate ? (
                                            <LocalDateTime time={false}>
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
                                        size="sm"
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
                                <Row>
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
