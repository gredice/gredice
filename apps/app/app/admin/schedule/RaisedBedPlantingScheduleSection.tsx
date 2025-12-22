'use client';

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
import { raisedBedPlanted } from '../../(actions)/raisedBedFieldsActions';
import { AcceptRaisedBedFieldModal } from './AcceptRaisedBedFieldModal';
import { BulkApproveRaisedBedButton } from './BulkApproveRaisedBedButton';
import { CancelRaisedBedFieldModal } from './CancelRaisedBedFieldModal';
import { CopyTasksButton } from './CopyTasksButton';
import { RescheduleRaisedBedFieldModal } from './RescheduleRaisedBedFieldModal';
import {
    formatMinutes,
    isFieldApproved,
    isFieldCompleted,
    PLANTING_TASK_DURATION_MINUTES,
} from './scheduleShared';
import type { RaisedBed, RaisedBedField } from './types';

interface RaisedBedPlantingScheduleSectionProps {
    physicalId: string;
    raisedBeds: RaisedBed[];
    scheduledFields: RaisedBedField[];
    plantSorts: EntityStandardized[] | null | undefined;
}

export function RaisedBedPlantingScheduleSection({
    physicalId,
    raisedBeds,
    scheduledFields,
    plantSorts,
}: RaisedBedPlantingScheduleSectionProps) {
    if (raisedBeds.length === 0) {
        return null;
    }

    const sortedRaisedBeds = [...raisedBeds].sort((a, b) => a.id - b.id);

    const dayFields = scheduledFields
        .filter((field) =>
            sortedRaisedBeds.some(
                (raisedBed) => raisedBed.id === field.raisedBedId,
            ),
        )
        .map((field) => ({
            ...field,
            physicalPositionIndex: sortedRaisedBeds
                .at(0)
                ?.fields.find(
                    (raisedBedField) => raisedBedField.id === field.id,
                )
                ? field.positionIndex + 1
                : field.positionIndex + 10,
        }))
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
            text: `${field.physicalPositionIndex} - sijanje: ${totalPlants} ${field.plantSortId ? `${sortData?.information?.name}` : '?'}`,
            approved: isFieldApproved(field.plantStatus),
        };
    });

    const fieldsToApprove = dayFields
        .filter(
            (field) =>
                !isFieldApproved(field.plantStatus) &&
                !isFieldCompleted(field.plantStatus),
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
                raisedBedId: field.raisedBedId,
                positionIndex: field.positionIndex,
                label: `${field.physicalPositionIndex} - sijanje: ${numberOfPlants} ${field.plantSortId ? `${sortData?.information?.name}` : 'Nepoznato'}`,
            };
        });

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
        <Stack key={physicalId} spacing={1}>
            <Row spacing={0.5} className="items-center flex-wrap gap-y-1">
                <BulkApproveRaisedBedButton
                    physicalId={physicalId.toString()}
                    fields={fieldsToApprove}
                    operations={[]}
                />
                <RaisedBedLabel physicalId={physicalId} />
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
            <Stack spacing={1}>
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
                                    {fieldCompleted ? (
                                        <Checkbox
                                            className="size-5 mx-2"
                                            checked
                                            disabled
                                        />
                                    ) : field.plantSortId && !fieldApproved ? (
                                        <AcceptRaisedBedFieldModal
                                            raisedBedId={field.raisedBedId}
                                            positionIndex={field.positionIndex}
                                            label={fieldLabel}
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
                                        field={{
                                            raisedBedId: field.raisedBedId,
                                            positionIndex: field.positionIndex,
                                        }}
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
            </Stack>
        </Stack>
    );
}
