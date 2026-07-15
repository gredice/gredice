import type {
    EntityStandardized,
    RaisedBedFieldAssignableFarmUser,
} from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
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
import { ScheduleTaskBlockedDetails } from './ScheduleTaskBlockedDetails';
import { ScheduleTaskBlockerModal } from './ScheduleTaskBlockerModal';
import { ScheduleTaskDateChip } from './ScheduleTaskDateChip';
import { ScheduleTaskDetailsLink } from './ScheduleTaskDetailsLink';
import { ScheduleTaskDurationChip } from './ScheduleTaskDurationChip';
import { ScheduleTaskStateControl } from './ScheduleTaskStateControl';
import { ScheduleTaskStatusChip } from './ScheduleTaskStatusChip';
import type { FarmScheduleDayData } from './scheduleData';
import { PLANTING_TASK_DURATION_MINUTES } from './scheduleShared';
import { getSchedulePlantingTaskAssignment } from './scheduleTaskAssignment';
import type { SchedulePlantingTaskIdentity } from './scheduleTaskIdentity';
import {
    getScheduleTaskAnchorId,
    getScheduleTaskLabelId,
} from './scheduleTaskIds';
import { buildScheduleTaskGuidanceHref } from './scheduleTaskNavigation';
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
> &
    Partial<
        Pick<
            FarmScheduleDayData['scheduledFields'][number],
            'blockedAt' | 'blockImageUrls' | 'blockNote' | 'blockReasonLabel'
        >
    >;

interface FarmSchedulePlantingTaskCardProps {
    field: FarmSchedulePlantingField;
    label: string;
    plantingIdentity: SchedulePlantingTaskIdentity | null;
    plantSort: EntityStandardized | undefined;
    userId: string;
    completionAction?: ReactNode;
    assignedUserByFieldIdPromise: Promise<
        Map<number, RaisedBedFieldAssignableFarmUser>
    >;
    selectedDateKey: string;
}

export function FarmSchedulePlantingTaskCard({
    field,
    label,
    plantingIdentity,
    plantSort,
    userId,
    completionAction,
    assignedUserByFieldIdPromise,
    selectedDateKey,
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
        taskPresentation.showCompletionControl &&
        !lockedByAssignment &&
        Boolean(plantingIdentity);
    const greenhouseSowing = field.sowingLocation === 'greenhouse';
    const taskAnchorId = getScheduleTaskAnchorId('planting', field.id);
    const taskLabelId = getScheduleTaskLabelId('planting', field.id);
    const guidanceHref = plantSort
        ? buildScheduleTaskGuidanceHref({
              dateKey: selectedDateKey,
              guidancePath: `/plants/${plantSort.id}`,
              taskId: field.id,
          })
        : null;
    const detailsContent = (
        <Row spacing={2} className="min-w-0 items-start justify-between gap-3">
            <SchedulePlantVisual plantSort={plantSort} label={label} />
            <Stack spacing={1} className="min-w-0 grow">
                <Typography
                    id={taskLabelId}
                    className={
                        taskPresentation.isCompleted
                            ? 'line-through text-muted-foreground [overflow-wrap:anywhere]'
                            : '[overflow-wrap:anywhere]'
                    }
                >
                    {label}
                </Typography>
                <Row spacing={2} className="items-center flex-wrap gap-y-1">
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
    );

    return (
        <article
            aria-labelledby={taskLabelId}
            id={taskAnchorId}
            tabIndex={-1}
            data-task-state={taskState}
            className={cx(
                'scroll-mt-4 rounded-lg border px-3 py-2 outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 [&[data-schedule-task-restored]]:ring-2 [&[data-schedule-task-restored]]:ring-primary [&[data-schedule-task-restored]]:ring-offset-2',
                taskPresentation.isCompleted ? 'bg-muted/30' : 'bg-white',
                lockedByAssignment &&
                    !taskPresentation.isCompleted &&
                    'bg-muted/20',
            )}
        >
            {guidanceHref ? (
                <ScheduleTaskDetailsLink
                    actionLabel="Otvori upute za biljku"
                    href={guidanceHref}
                >
                    {detailsContent}
                </ScheduleTaskDetailsLink>
            ) : (
                <div className="min-w-0 px-1 py-1">
                    {detailsContent}
                    <Typography
                        className="mt-1.5 text-muted-foreground"
                        level="body2"
                    >
                        Upute za biljku trenutno nisu dostupne.
                    </Typography>
                    <Button
                        className="mt-2"
                        fullWidth
                        href={`/raised-beds/${field.raisedBedId}`}
                        size="lg"
                        variant="outlined"
                    >
                        Otvori gredicu
                    </Button>
                </div>
            )}
            {taskState === 'blocked' && (
                <ScheduleTaskBlockedDetails
                    blockedAt={field.blockedAt}
                    imageUrls={field.blockImageUrls}
                    note={field.blockNote}
                    reason={field.blockReasonLabel}
                    taskKey={`planting-${field.raisedBedId}-${field.positionIndex}`}
                />
            )}
            <ScheduleTaskStateControl
                action={canComplete ? completionAction : undefined}
                actionLabel="Dovrši sijanje"
                blockerAction={
                    canComplete && plantingIdentity ? (
                        <ScheduleTaskBlockerModal
                            label={label}
                            target={{
                                ...plantingIdentity,
                                kind: 'planting',
                                positionIndex: field.positionIndex,
                                raisedBedId: field.raisedBedId,
                            }}
                        />
                    ) : undefined
                }
                label={label}
                state={taskState}
                unavailableTitle={
                    plantingIdentity
                        ? 'Sijanje je dodijeljeno drugom korisniku.'
                        : 'Sijanje se ne može dovršiti dok podaci zadatka nisu dostupni.'
                }
            />
        </article>
    );
}

export default FarmSchedulePlantingTaskCard;
