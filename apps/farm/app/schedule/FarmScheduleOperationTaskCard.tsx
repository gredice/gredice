import type { EntityStandardized } from '@gredice/storage';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { cx } from '@gredice/ui/utils';
import type { ReactNode } from 'react';
import { OperationCompletionAttachments } from './OperationCompletionAttachments';
import { OperationRequirementIcons } from './OperationRequirementIcons';
import { ScheduleTaskAgeIndicatorChip } from './ScheduleTaskAgeIndicatorChip';
import { ScheduleTaskDateChip } from './ScheduleTaskDateChip';
import { ScheduleTaskDetailsLink } from './ScheduleTaskDetailsLink';
import { ScheduleTaskDurationChip } from './ScheduleTaskDurationChip';
import { ScheduleTaskStateControl } from './ScheduleTaskStateControl';
import { ScheduleTaskStatusChip } from './ScheduleTaskStatusChip';
import type { FarmScheduleDayData } from './scheduleData';
import {
    getScheduleOperationCompletionRequirements,
    isScheduleOperationRequirementVisible,
} from './scheduleOperationRequirements';
import { getScheduleOperationTaskAssignment } from './scheduleTaskAssignment';
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
    userId: string;
};

export function FarmScheduleOperationTaskCard({
    completionAction,
    operation,
    operationData,
    userId,
}: FarmScheduleOperationTaskCardProps) {
    const taskState = getOperationTaskState(operation.status);
    const taskPresentation = getScheduleTaskPresentation(taskState);
    const assignment = getScheduleOperationTaskAssignment(operation, userId);
    const canComplete =
        taskPresentation.showCompletionControl && assignment !== 'other';
    const requirements =
        getScheduleOperationCompletionRequirements(operationData);
    const attachImages = isScheduleOperationRequirementVisible(
        requirements.images,
    );
    const attachImagesRequired = requirements.images === 'required';
    const attachNotes = isScheduleOperationRequirementVisible(
        requirements.notes,
    );
    const attachNotesRequired = requirements.notes === 'required';
    const showRequirementIcons =
        taskPresentation.showRequirementIndicators &&
        (attachImages || attachNotes);
    const hasCompletionAttachments =
        taskPresentation.showCompletionAttachments &&
        (Boolean(operation.completionNotes?.trim()) ||
            Boolean(operation.imageUrls?.some((url) => url.trim().length > 0)));
    const detailsContent = (
        <Row spacing={2} className="min-w-0 items-start justify-between gap-3">
            <Stack spacing={1} className="min-w-0 grow">
                <Typography
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
            {(showRequirementIcons || operation.assignedUser) && (
                <Row spacing={1} className="shrink-0 items-center">
                    {showRequirementIcons && (
                        <OperationRequirementIcons
                            attachImages={attachImages}
                            attachImagesRequired={attachImagesRequired}
                            attachNotes={attachNotes}
                            attachNotesRequired={attachNotesRequired}
                        />
                    )}
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
            )}
        </Row>
    );

    return (
        <div
            data-task-state={taskState}
            className={cx(
                'rounded-lg border px-3 py-2',
                taskPresentation.isCompleted ? 'bg-muted/30' : 'bg-white',
            )}
        >
            {operationData ? (
                <ScheduleTaskDetailsLink
                    actionLabel="Otvori upute"
                    href={`/operations/${operation.entityId}`}
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
                        Upute trenutno nisu dostupne.
                    </Typography>
                </div>
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
                unavailableTitle="Radnja je dodijeljena drugom korisniku."
            />
        </div>
    );
}
