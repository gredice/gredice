import { Chip } from '@gredice/ui/Chip';
import { Camera, FileText, ListTodo, Warning } from '@gredice/ui/icons';
import type { ReactNode } from 'react';
import {
    type FarmTodayTaskActionContext,
    FarmTodayTaskActions,
} from './FarmTodayTaskActions';
import type { FarmTodayTask, FarmTodayTaskAssignment } from './farmTodayModel';
import { ScheduleTaskDateChip } from './schedule/ScheduleTaskDateChip';
import { ScheduleTaskDurationChip } from './schedule/ScheduleTaskDurationChip';
import { ScheduleTaskLocation } from './schedule/ScheduleTaskLocation';
import { ScheduleTaskStatusChip } from './schedule/ScheduleTaskStatusChip';
import type { ScheduleOperationRequirementLevel } from './schedule/scheduleOperationRequirements';

type FarmTodayTaskCardProps = {
    actionContext?: FarmTodayTaskActionContext;
    emphasis?: 'next' | 'standard';
    task: FarmTodayTask;
};

function renderAssignmentChip(assignment: FarmTodayTaskAssignment) {
    return (
        <Chip
            color={assignment === 'mine' ? 'neutral' : 'warning'}
            size="sm"
            startDecorator={
                assignment === 'shared' ? <Warning aria-hidden /> : undefined
            }
            variant="soft"
        >
            {assignment === 'mine' ? 'Dodijeljeno meni' : 'Nije dodijeljeno'}
        </Chip>
    );
}

function renderActionableStateChip(task: FarmTodayTask) {
    if (task.state !== 'actionable') {
        return <ScheduleTaskStatusChip state={task.state} />;
    }

    if (task.overdue) {
        return (
            <Chip
                color={
                    task.ageIndicator?.level === 'critical'
                        ? 'error'
                        : 'warning'
                }
                size="sm"
                startDecorator={<Warning aria-hidden />}
                title={task.ageIndicator?.title ?? 'Zadatak kasni.'}
                variant="soft"
            >
                {task.ageIndicator?.label ?? 'Kasni'}
            </Chip>
        );
    }

    return (
        <Chip
            color="success"
            size="sm"
            startDecorator={<ListTodo aria-hidden />}
            variant="soft"
        >
            Za napraviti
        </Chip>
    );
}

function requirementLabel(
    kind: 'images' | 'notes',
    level: ScheduleOperationRequirementLevel,
) {
    const noun = kind === 'images' ? 'Fotografija' : 'Napomena';

    if (level === 'required') {
        return `${noun} obavezna`;
    }
    if (level === 'optional') {
        return `${noun} po želji`;
    }
    return null;
}

function renderProofRequirements(task: FarmTodayTask) {
    if (task.state === 'blocked') {
        return null;
    }

    const { images, notes } = task.proofRequirements;
    const imageLabel = requirementLabel('images', images);
    const notesLabel = requirementLabel('notes', notes);
    const requirementsUnknown = images === 'unknown' || notes === 'unknown';
    const visibleRequirements: ReactNode[] = [];

    if (imageLabel) {
        visibleRequirements.push(
            <span
                className="inline-flex min-w-0 items-center gap-1"
                key="images"
            >
                <Camera aria-hidden className="size-3.5 shrink-0" />
                {imageLabel}
            </span>,
        );
    }
    if (notesLabel) {
        visibleRequirements.push(
            <span
                className="inline-flex min-w-0 items-center gap-1"
                key="notes"
            >
                <FileText aria-hidden className="size-3.5 shrink-0" />
                {notesLabel}
            </span>,
        );
    }
    if (requirementsUnknown) {
        visibleRequirements.push(
            <span
                className="inline-flex min-w-0 items-center gap-1"
                key="unknown"
            >
                <Warning aria-hidden className="size-3.5 shrink-0" />
                Zahtjevi dokaza nisu dostupni
            </span>,
        );
    }
    if (visibleRequirements.length === 0) {
        return null;
    }

    return (
        <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {visibleRequirements}
        </div>
    );
}

export function FarmTodayTaskCard({
    actionContext,
    emphasis = 'standard',
    task,
}: FarmTodayTaskCardProps) {
    const blockerTimestamp = task.blocker?.occurredAt
        ? new Date(task.blocker.occurredAt)
        : null;
    const blockerTimestampLabel =
        blockerTimestamp && Number.isFinite(blockerTimestamp.getTime())
            ? new Intl.DateTimeFormat('hr-HR', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: 'Europe/Zagreb',
              }).format(blockerTimestamp)
            : null;
    const taskLabelId = `farm-today-task-label-${task.key}`;
    const raisedBedLabel =
        task.location.kind === 'farm'
            ? task.location.label
            : `${task.location.kind === 'greenhouse' ? 'Staklenik · ' : ''}${
                  task.location.physicalId
                      ? `Gr ${task.location.physicalId}`
                      : `Gredica ${task.location.raisedBedId}`
              }`;

    return (
        <article
            aria-labelledby={taskLabelId}
            className="min-w-0 rounded-lg border bg-white px-3 py-2 text-sm text-foreground dark:bg-card"
            data-farm-today-task-card={task.key}
            data-task-state={task.state}
        >
            <div className="min-w-0 space-y-1.5">
                {emphasis === 'next' ? (
                    <div className="text-[0.6875rem] font-semibold uppercase tracking-wide text-primary">
                        Sljedeći zadatak
                    </div>
                ) : null}
                <div
                    className="min-w-0 text-sm font-semibold leading-snug [overflow-wrap:anywhere] sm:text-base"
                    id={taskLabelId}
                >
                    {task.label}
                </div>
                <ScheduleTaskLocation
                    positionNumber={
                        task.location.kind === 'farm'
                            ? null
                            : task.location.positionNumber
                    }
                    raisedBedLabel={raisedBedLabel}
                />
                <div className="flex min-w-0 flex-wrap gap-1.5">
                    {renderActionableStateChip(task)}
                    {renderAssignmentChip(task.assignment)}
                    <ScheduleTaskDateChip scheduledDate={task.scheduledDate} />
                    {task.durationMinutes === null ? null : (
                        <ScheduleTaskDurationChip
                            minutes={task.durationMinutes}
                        />
                    )}
                </div>
                {renderProofRequirements(task)}
                {task.blocker ? (
                    <div className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-950 dark:bg-amber-950/40 dark:text-amber-100 [overflow-wrap:anywhere]">
                        <div className="font-semibold">
                            Prijavljeno administratorima
                        </div>
                        <div>
                            {task.blocker.reason ||
                                'Zadatak nije bilo moguće dovršiti.'}
                        </div>
                        {blockerTimestampLabel ? (
                            <time
                                dateTime={task.blocker.occurredAt ?? undefined}
                            >
                                {blockerTimestampLabel}
                            </time>
                        ) : null}
                    </div>
                ) : null}
            </div>
            {actionContext ? (
                <FarmTodayTaskActions context={actionContext} task={task} />
            ) : null}
        </article>
    );
}
