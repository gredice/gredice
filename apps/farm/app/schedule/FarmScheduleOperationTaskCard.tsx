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
import { ScheduleTaskDurationChip } from './ScheduleTaskDurationChip';
import { ScheduleTaskStateControl } from './ScheduleTaskStateControl';
import { ScheduleTaskStatusChip } from './ScheduleTaskStatusChip';
import type { FarmScheduleDayData } from './scheduleData';
import {
    getOperationTaskState,
    getScheduleTaskPresentation,
} from './scheduleTaskState';

type FarmOperation = FarmScheduleDayData['scheduledOperations'][number];

export type FarmOperationCardData = Pick<
    FarmOperation,
    | 'assignedUser'
    | 'assignedUserId'
    | 'completionNotes'
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
    const canComplete =
        taskPresentation.showCompletionControl &&
        (!operation.assignedUserId || operation.assignedUserId === userId);
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
    const showRequirementIcons =
        taskPresentation.showRequirementIndicators &&
        (attachImages || attachNotes);

    return (
        <div
            data-task-state={taskState}
            className={cx(
                'rounded-lg border px-3 py-2 transition-opacity',
                taskPresentation.isCompleted
                    ? 'bg-white/70 opacity-70'
                    : 'bg-white',
            )}
        >
            <Row
                spacing={2}
                className="min-w-0 items-start justify-between gap-3"
            >
                <Row spacing={2} className="min-w-0 grow items-start">
                    <ScheduleTaskStateControl
                        action={canComplete ? completionAction : undefined}
                        label={operation.label}
                        state={taskState}
                        unavailableTitle="Radnja je dodijeljena drugom korisniku."
                    />
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
                        <Row
                            spacing={2}
                            className="items-center flex-wrap gap-y-1"
                        >
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
                </Row>
                {(showRequirementIcons ||
                    taskPresentation.showCompletionAttachments ||
                    operation.assignedUser) && (
                    <Row spacing={1} className="shrink-0 items-center">
                        {showRequirementIcons && (
                            <OperationRequirementIcons
                                attachImages={attachImages}
                                attachImagesRequired={attachImagesRequired}
                                attachNotes={attachNotes}
                                attachNotesRequired={attachNotesRequired}
                            />
                        )}
                        {taskPresentation.showCompletionAttachments && (
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
        </div>
    );
}
