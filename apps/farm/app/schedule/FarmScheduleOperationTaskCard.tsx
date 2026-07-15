import type { EntityStandardized } from '@gredice/storage';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { cx } from '@gredice/ui/utils';
import type { ReactNode } from 'react';
import { OperationCompletionAttachments } from './OperationCompletionAttachments';
import { OperationProofRequirements } from './OperationProofRequirements';
import { ScheduleTaskAgeIndicatorChip } from './ScheduleTaskAgeIndicatorChip';
import { ScheduleTaskDateChip } from './ScheduleTaskDateChip';
import { ScheduleTaskDetailsLink } from './ScheduleTaskDetailsLink';
import { ScheduleTaskDurationChip } from './ScheduleTaskDurationChip';
import { ScheduleTaskStateControl } from './ScheduleTaskStateControl';
import { ScheduleTaskStatusChip } from './ScheduleTaskStatusChip';
import type { FarmScheduleDayData } from './scheduleData';
import {
    getScheduleOperationCompletionRequirements,
    hasVisibleScheduleOperationCompletionRequirements,
} from './scheduleOperationRequirements';
import { getScheduleOperationTaskAssignment } from './scheduleTaskAssignment';
import {
    getScheduleOperationProofRequirementsId,
    getScheduleTaskAnchorId,
    getScheduleTaskLabelId,
} from './scheduleTaskIds';
import { buildScheduleTaskGuidanceHref } from './scheduleTaskNavigation';
import {
    getOperationTaskState,
    getScheduleTaskPresentation,
} from './scheduleTaskState';

type FarmOperation = FarmScheduleDayData['scheduledOperations'][number];

export type FarmOperationCardData = Pick<
    FarmOperation,
    | 'assignedUser'
    | 'assignedUserId'
    | 'assignedUserIds'
    | 'completionNotes'
    | 'entityId'
    | 'id'
    | 'imageUrls'
    | 'scheduledDate'
    | 'status'
> & {
    durationMinutes: number;
    label: string;
};

type FarmScheduleOperationTaskCardProps = {
    completionAction?: ReactNode;
    operation: FarmOperationCardData;
    operationData: EntityStandardized | undefined;
    selectedDateKey: string;
    userId: string;
};

export function FarmScheduleOperationTaskCard({
    completionAction,
    operation,
    operationData,
    selectedDateKey,
    userId,
}: FarmScheduleOperationTaskCardProps) {
    const taskState = getOperationTaskState(operation.status);
    const taskPresentation = getScheduleTaskPresentation(taskState);
    const assignment = getScheduleOperationTaskAssignment(operation, userId);
    const canComplete =
        taskPresentation.showCompletionControl &&
        assignment !== 'other' &&
        Boolean(operationData);
    const requirements =
        getScheduleOperationCompletionRequirements(operationData);
    const showProofRequirements =
        taskPresentation.showRequirementIndicators &&
        hasVisibleScheduleOperationCompletionRequirements(requirements);
    const proofRequirementsId = getScheduleOperationProofRequirementsId(
        operation.id,
    );
    const taskAnchorId = getScheduleTaskAnchorId('operation', operation.id);
    const taskLabelId = getScheduleTaskLabelId('operation', operation.id);
    const guidanceHref = operationData
        ? buildScheduleTaskGuidanceHref({
              dateKey: selectedDateKey,
              guidancePath: `/operations/${operation.entityId}`,
              taskId: operation.id,
          })
        : null;
    const hasCompletionAttachments =
        taskPresentation.showCompletionAttachments &&
        (Boolean(operation.completionNotes?.trim()) ||
            Boolean(operation.imageUrls?.some((url) => url.trim().length > 0)));
    const detailsContent = (
        <Row spacing={2} className="min-w-0 items-start justify-between gap-3">
            <Stack spacing={1} className="min-w-0 grow">
                <Typography
                    id={taskLabelId}
                    className={
                        taskPresentation.isCompleted
                            ? 'line-through text-muted-foreground [overflow-wrap:anywhere]'
                            : '[overflow-wrap:anywhere]'
                    }
                >
                    {operation.label}
                </Typography>
                <Row spacing={2} className="items-center flex-wrap gap-y-1">
                    <ScheduleTaskStatusChip state={taskState} />
                    <ScheduleTaskDurationChip
                        minutes={operation.durationMinutes}
                    />
                    <ScheduleTaskDateChip
                        scheduledDate={operation.scheduledDate}
                    />
                    {taskPresentation.showAgeIndicator && (
                        <ScheduleTaskAgeIndicatorChip
                            scheduledDate={operation.scheduledDate}
                        />
                    )}
                </Row>
            </Stack>
            {operation.assignedUser && (
                <div
                    className="shrink-0"
                    title={`Dodijeljeno: ${operation.assignedUser.displayName ?? operation.assignedUser.userName}`}
                >
                    <UserAvatar
                        avatarUrl={operation.assignedUser.avatarUrl}
                        displayName={
                            operation.assignedUser.displayName ??
                            operation.assignedUser.userName
                        }
                        className="size-7 rounded-full"
                    />
                </div>
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
            )}
        >
            {guidanceHref ? (
                <ScheduleTaskDetailsLink
                    actionLabel="Otvori upute"
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
                        Upute za radnju trenutno nisu dostupne.
                    </Typography>
                    <Typography
                        className="mt-1 text-muted-foreground"
                        level="body2"
                    >
                        Zahtjevi za dovršetak trenutno nisu dostupni.
                    </Typography>
                </div>
            )}
            {showProofRequirements && (
                <OperationProofRequirements
                    className="mt-2"
                    id={proofRequirementsId}
                    requirements={requirements}
                />
            )}
            {hasCompletionAttachments && (
                <OperationCompletionAttachments
                    className="mt-2 border-t pt-2"
                    operationId={operation.id}
                    notes={operation.completionNotes}
                    imageUrls={operation.imageUrls}
                />
            )}
            <ScheduleTaskStateControl
                action={canComplete ? completionAction : undefined}
                actionLabel="Dovrši radnju"
                label={operation.label}
                state={taskState}
                unavailableTitle={
                    operationData
                        ? 'Radnja je dodijeljena drugom korisniku.'
                        : 'Radnja se ne može dovršiti dok zahtjevi za dovršetak nisu dostupni.'
                }
            />
        </article>
    );
}
