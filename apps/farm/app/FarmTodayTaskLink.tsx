import { Chip } from '@gredice/ui/Chip';
import {
    Camera,
    FileText,
    ListTodo,
    MapPin,
    Navigate,
    Warning,
} from '@gredice/ui/icons';
import NextLink from 'next/link';
import type { ReactNode } from 'react';
import type { FarmTodayTaskSource } from '../components/analytics/farmAnalytics';
import type { FarmTodayTask, FarmTodayTaskAssignment } from './farmTodayModel';
import { ScheduleTaskDateChip } from './schedule/ScheduleTaskDateChip';
import { ScheduleTaskDurationChip } from './schedule/ScheduleTaskDurationChip';
import { ScheduleTaskStatusChip } from './schedule/ScheduleTaskStatusChip';
import type { ScheduleOperationRequirementLevel } from './schedule/scheduleOperationRequirements';

type FarmTodayTaskLinkProps = {
    emphasis?: 'next' | 'standard';
    source: FarmTodayTaskSource;
    task: FarmTodayTask;
};

function AssignmentChip({
    assignment,
}: {
    assignment: FarmTodayTaskAssignment;
}) {
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

function ActionableStateChip({ task }: { task: FarmTodayTask }) {
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

function ProofRequirements({ task }: { task: FarmTodayTask }) {
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
        visibleRequirements.push(
            <span className="inline-flex min-w-0 items-center gap-1" key="none">
                <FileText aria-hidden className="size-3.5 shrink-0" />
                Dokaz nije potreban
            </span>,
        );
    }

    return (
        <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {visibleRequirements}
        </div>
    );
}

export function FarmTodayTaskLink({
    emphasis = 'standard',
    source,
    task,
}: FarmTodayTaskLinkProps) {
    const destinationLabel =
        task.kind === 'operation' ? 'Otvori upute' : 'Otvori gredicu';

    return (
        <NextLink
            className="flex h-auto min-h-11 w-full min-w-0 items-start justify-start gap-2 rounded-none bg-transparent px-3 py-2 text-left text-sm text-foreground transition-colors first:rounded-t-[calc(var(--radius)-1px)] last:rounded-b-[calc(var(--radius)-1px)] hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            data-farm-analytics="today_task"
            data-farm-task-assignment={task.assignment}
            data-farm-task-kind={task.kind}
            data-farm-task-overdue={task.overdue ? 'true' : 'false'}
            data-farm-task-source={source}
            data-farm-task-state={task.state}
            href={{ pathname: task.href }}
        >
            <div className="min-w-0 grow">
                <div
                    className="min-w-0 space-y-1.5"
                    data-farm-today-task={task.key}
                    data-task-state={task.state}
                >
                    {emphasis === 'next' ? (
                        <div className="text-[0.6875rem] font-semibold uppercase tracking-wide text-primary">
                            Sljedeći zadatak
                        </div>
                    ) : null}
                    <div className="min-w-0 text-sm font-semibold leading-snug [overflow-wrap:anywhere] sm:text-base">
                        {task.label}
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex min-w-0 items-start gap-1 [overflow-wrap:anywhere]">
                            <MapPin
                                aria-hidden
                                className="mt-0.5 size-3.5 shrink-0"
                            />
                            {task.location.label}
                        </span>
                    </div>
                    <div className="flex min-w-0 flex-wrap gap-1.5">
                        <ActionableStateChip task={task} />
                        <AssignmentChip assignment={task.assignment} />
                        <ScheduleTaskDateChip
                            scheduledDate={task.scheduledDate}
                        />
                        {task.durationMinutes === null ? null : (
                            <ScheduleTaskDurationChip
                                minutes={task.durationMinutes}
                            />
                        )}
                    </div>
                    <ProofRequirements task={task} />
                    <span className="inline-flex min-h-6 items-center gap-1 text-xs font-semibold text-primary">
                        {destinationLabel}
                        <Navigate aria-hidden className="size-3.5" />
                    </span>
                </div>
            </div>
        </NextLink>
    );
}
