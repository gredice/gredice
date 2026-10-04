import type {
    EntityStandardized,
    RaisedBedPlantingWithFields,
    SelectedRaisedBedPlantingTaskReadModel,
} from '@gredice/storage';
import { Chip } from '@gredice/ui/Chip';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { CompleteSelectedPlantingModal } from './CompletePlantingModal';
import { SchedulePlantVisual } from './SchedulePlantVisual';
import { ScheduleTaskBlockedDetails } from './ScheduleTaskBlockedDetails';
import { ScheduleTaskBlockerModal } from './ScheduleTaskBlockerModal';
import { ScheduleTaskDateChip } from './ScheduleTaskDateChip';
import { ScheduleTaskDurationChip } from './ScheduleTaskDurationChip';
import { ScheduleTaskLocation } from './ScheduleTaskLocation';
import { ScheduleTaskStateControl } from './ScheduleTaskStateControl';
import { ScheduleTaskStatusChip } from './ScheduleTaskStatusChip';
import { PLANTING_TASK_DURATION_MINUTES } from './scheduleShared';
import {
    getScheduleTaskPresentation,
    getSelectedPlantingTaskState,
} from './scheduleTaskState';

function getAssignmentLabel(
    assignedUserIds: readonly string[],
    userId: string,
) {
    if (assignedUserIds.length === 0) {
        return 'Nije dodijeljeno';
    }
    if (assignedUserIds.includes(userId)) {
        return 'Dodijeljeno meni';
    }
    return 'Dodijeljeno drugom korisniku';
}

type SelectedPlantingCardTask = Pick<
    SelectedRaisedBedPlantingTaskReadModel,
    | 'assignedUserIds'
    | 'block'
    | 'identity'
    | 'scheduledDate'
    | 'sowingLocation'
    | 'status'
>;

export type FarmScheduleSelectedPlantingTaskCardPlanting = Pick<
    RaisedBedPlantingWithFields,
    'configurationSource' | 'id'
> & {
    selectedTask: SelectedPlantingCardTask | null;
};

export function FarmScheduleSelectedPlantingTaskCard({
    label,
    physicalPositionNumbers,
    planting,
    plantSort,
    raisedBedLabel,
    userId,
}: {
    label: string;
    physicalPositionNumbers: readonly number[];
    planting: FarmScheduleSelectedPlantingTaskCardPlanting;
    plantSort: EntityStandardized | undefined;
    raisedBedLabel: string;
    userId: string;
}) {
    const task = planting.selectedTask;
    if (planting.configurationSource !== 'selected' || !task) {
        return null;
    }

    const taskState = getSelectedPlantingTaskState(task.status);
    const taskPresentation = getScheduleTaskPresentation(taskState);
    const lockedByAssignment =
        taskPresentation.showCompletionControl &&
        task.assignedUserIds.length > 0 &&
        !task.assignedUserIds.includes(userId);
    const canComplete =
        taskPresentation.showCompletionControl && !lockedByAssignment;
    const taskAnchorId = `schedule-task-selected-planting-${planting.id.toString()}`;
    const taskLabelId = `${taskAnchorId}-label`;
    const positionLabel = [...physicalPositionNumbers]
        .sort((left, right) => left - right)
        .join(', ');

    return (
        <article
            aria-labelledby={taskLabelId}
            className={cx(
                'scroll-mt-4 rounded-lg border px-3 py-2 outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                taskPresentation.isCompleted ? 'bg-muted/30' : 'bg-white',
                lockedByAssignment &&
                    !taskPresentation.isCompleted &&
                    'bg-muted/20',
            )}
            data-selected-planting-task-id={planting.id}
            data-task-state={taskState}
            id={taskAnchorId}
            tabIndex={-1}
        >
            <div className="min-w-0 px-1 py-1">
                <Stack className="min-w-0" spacing={1}>
                    <Row
                        className="min-w-0 items-start justify-between gap-3"
                        spacing={2}
                    >
                        <SchedulePlantVisual
                            plantSort={plantSort}
                            label={label}
                        />
                        <Typography
                            className={cx(
                                'min-w-0 grow [overflow-wrap:anywhere]',
                                taskPresentation.isCompleted &&
                                    'line-through text-muted-foreground',
                            )}
                            id={taskLabelId}
                        >
                            {label}
                        </Typography>
                    </Row>
                    <Row className="items-center flex-wrap gap-y-1" spacing={1}>
                        <ScheduleTaskLocation
                            inline
                            positionNumber={null}
                            raisedBedLabel={raisedBedLabel}
                        />
                        <Chip color="neutral" size="sm" variant="soft">
                            Polja {positionLabel}
                        </Chip>
                        <ScheduleTaskDurationChip
                            compact
                            minutes={PLANTING_TASK_DURATION_MINUTES}
                        />
                        <ScheduleTaskDateChip
                            compact
                            scheduledDate={task.scheduledDate}
                        />
                        <ScheduleTaskStatusChip state={taskState} />
                        {task.sowingLocation === 'greenhouse' ? (
                            <Chip color="success" size="sm" variant="soft">
                                Staklenik
                            </Chip>
                        ) : null}
                        <Chip
                            color={
                                task.assignedUserIds.length === 0
                                    ? 'warning'
                                    : 'neutral'
                            }
                            size="sm"
                            variant="soft"
                        >
                            {getAssignmentLabel(task.assignedUserIds, userId)}
                        </Chip>
                    </Row>
                </Stack>
            </div>
            {taskState === 'blocked' ? (
                <ScheduleTaskBlockedDetails
                    blockedAt={task.block?.blockedAt}
                    imageUrls={task.block?.images}
                    note={task.block?.note}
                    reason={task.block?.reasonLabel}
                    taskKey={`selected-planting-${planting.id.toString()}`}
                />
            ) : null}
            <ScheduleTaskStateControl
                action={
                    canComplete ? (
                        <CompleteSelectedPlantingModal
                            {...task.identity}
                            label={label}
                        />
                    ) : undefined
                }
                actionLabel="Dovrši sijanje"
                blockerAction={
                    canComplete ? (
                        <ScheduleTaskBlockerModal
                            label={label}
                            target={task.identity}
                        />
                    ) : undefined
                }
                label={label}
                layout="inline"
                state={taskState}
                unavailableTitle={
                    lockedByAssignment
                        ? 'Sijanje je dodijeljeno drugom korisniku.'
                        : 'Sijanje se ne može dovršiti u trenutnom stanju.'
                }
            />
        </article>
    );
}
