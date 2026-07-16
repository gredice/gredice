import type {
    EntityStandardized,
    RaisedBedFieldAssignableFarmUser,
} from '@gredice/storage';
import { Chip } from '@gredice/ui/Chip';
import { Row } from '@gredice/ui/Row';
import { Skeleton } from '@gredice/ui/Skeleton';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { type ReactNode, Suspense } from 'react';
import { PlantingAssignedUserAvatar } from './PlantingAssignedUserAvatar';
import { SchedulePlantVisual } from './SchedulePlantVisual';
import { ScheduleTaskAgeIndicatorChip } from './ScheduleTaskAgeIndicatorChip';
import { ScheduleTaskDateChip } from './ScheduleTaskDateChip';
import { ScheduleTaskDetailsLink } from './ScheduleTaskDetailsLink';
import { ScheduleTaskDurationChip } from './ScheduleTaskDurationChip';
import { ScheduleTaskStateControl } from './ScheduleTaskStateControl';
import { ScheduleTaskStatusChip } from './ScheduleTaskStatusChip';
import type { FarmScheduleDayData } from './scheduleData';
import { PLANTING_TASK_DURATION_MINUTES } from './scheduleShared';
import { getSchedulePlantingTaskAssignment } from './scheduleTaskAssignment';
import {
    getPlantingTaskState,
    getScheduleTaskPresentation,
} from './scheduleTaskState';

type FarmSchedulePlantingField = Pick<
    FarmScheduleDayData['scheduledFields'][number],
    | 'assignedUserId'
    | 'assignedUserIds'
    | 'id'
    | 'plantScheduledDate'
    | 'plantStatus'
    | 'positionIndex'
    | 'raisedBedId'
    | 'sowingLocation'
>;

interface FarmSchedulePlantingTaskCardProps {
    field: FarmSchedulePlantingField;
    label: string;
    plantSort: EntityStandardized | undefined;
    userId: string;
    completionAction?: ReactNode;
    assignedUserByFieldIdPromise: Promise<
        Map<number, RaisedBedFieldAssignableFarmUser>
    >;
}

export function FarmSchedulePlantingTaskCard({
    field,
    label,
    plantSort,
    userId,
    completionAction,
    assignedUserByFieldIdPromise,
}: FarmSchedulePlantingTaskCardProps) {
    const taskState = getPlantingTaskState(field.plantStatus);
    if (!taskState) {
        return null;
    }

    const taskPresentation = getScheduleTaskPresentation(taskState);
    const lockedByAssignment =
        taskPresentation.showCompletionControl &&
        getSchedulePlantingTaskAssignment(field, userId) === 'other';
    const canComplete =
        taskPresentation.showCompletionControl && !lockedByAssignment;
    const greenhouseSowing = field.sowingLocation === 'greenhouse';

    return (
        <div
            data-task-state={taskState}
            className={cx(
                'rounded-lg border px-3 py-2',
                taskPresentation.isCompleted ? 'bg-muted/30' : 'bg-white',
                lockedByAssignment &&
                    !taskPresentation.isCompleted &&
                    'bg-muted/20',
            )}
        >
            <ScheduleTaskDetailsLink
                actionLabel="Otvori gredicu"
                href={`/raised-beds/${field.raisedBedId}`}
            >
                <Row
                    spacing={2}
                    className="min-w-0 items-start justify-between gap-3"
                >
                    <SchedulePlantVisual plantSort={plantSort} label={label} />
                    <Stack spacing={1} className="min-w-0 grow">
                        <Typography
                            className={
                                taskPresentation.isCompleted
                                    ? 'line-through text-muted-foreground [overflow-wrap:anywhere]'
                                    : '[overflow-wrap:anywhere]'
                            }
                        >
                            {label}
                        </Typography>
                        <Row
                            spacing={2}
                            className="items-center flex-wrap gap-y-1"
                        >
                            <ScheduleTaskStatusChip state={taskState} />
                            <ScheduleTaskDurationChip
                                minutes={PLANTING_TASK_DURATION_MINUTES}
                            />
                            {greenhouseSowing && (
                                <Chip size="sm" color="success" variant="soft">
                                    Staklenik
                                </Chip>
                            )}
                            <ScheduleTaskDateChip
                                scheduledDate={field.plantScheduledDate}
                            />
                            {taskPresentation.showAgeIndicator && (
                                <ScheduleTaskAgeIndicatorChip
                                    scheduledDate={field.plantScheduledDate}
                                />
                            )}
                        </Row>
                    </Stack>
                    {field.assignedUserId && (
                        <Suspense
                            fallback={
                                <Skeleton className="size-7 shrink-0 rounded-full" />
                            }
                        >
                            <PlantingAssignedUserAvatar
                                assignedUserByFieldIdPromise={
                                    assignedUserByFieldIdPromise
                                }
                                fieldId={field.id}
                            />
                        </Suspense>
                    )}
                </Row>
            </ScheduleTaskDetailsLink>
            <ScheduleTaskStateControl
                action={canComplete ? completionAction : undefined}
                actionLabel="Dovrši sijanje"
                label={label}
                state={taskState}
                unavailableTitle="Sijanje je dodijeljeno drugom korisniku."
            />
        </div>
    );
}

export default FarmSchedulePlantingTaskCard;
