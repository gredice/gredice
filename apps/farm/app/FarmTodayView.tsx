import { Alert } from '@gredice/ui/Alert';
import { MapPin, Warning } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { ReactNode } from 'react';
import { FarmTodayViewTracker } from '../components/analytics/FarmTodayViewTracker';
import {
    FarmTodayAvailableStatePanel,
    FarmTodayNoFarmState,
    FarmTodayUnavailableState,
} from './FarmTodayStatePanel';
import { FarmTodaySummary } from './FarmTodaySummary';
import type { FarmTodayTaskActionContext } from './FarmTodayTaskActions';
import { FarmTodayTaskCard } from './FarmTodayTaskCard';
import { FarmTodayTools } from './FarmTodayTools';
import type { FarmTodayData, FarmTodayTask } from './farmTodayModel';

type FarmTodayViewProps = {
    data: FarmTodayData;
    headerActions?: ReactNode;
    heading: ReactNode;
    taskActionContext?: FarmTodayTaskActionContext;
};

type FarmTodayTaskGroup = {
    key: string;
    label: string;
    tasks: FarmTodayTask[];
};

function getTaskGroup(task: FarmTodayTask) {
    if (task.location.kind === 'farm') {
        return {
            key: `farm:${task.location.farmId}`,
            label: task.location.label,
        };
    }

    const raisedBedLabel = task.location.physicalId
        ? `Gr ${task.location.physicalId}`
        : `Gredica ${task.location.raisedBedId}`;

    return {
        key: `raised-bed:${task.location.groupKey}`,
        label: raisedBedLabel,
    };
}

function groupTasks(tasks: FarmTodayTask[]) {
    const groups = new Map<string, FarmTodayTaskGroup>();

    for (const task of tasks) {
        const { key, label } = getTaskGroup(task);
        const group = groups.get(key);
        if (group) {
            group.tasks.push(task);
        } else {
            groups.set(key, { key, label, tasks: [task] });
        }
    }

    return [...groups.values()];
}

export function FarmTodayView({
    data,
    headerActions,
    heading,
    taskActionContext,
}: FarmTodayViewProps) {
    const viewTracker =
        data.status === 'ready' || data.status === 'partial' ? (
            <FarmTodayViewTracker
                dataStatus={data.status}
                hasNextTask={data.focusQueue.length > 0}
                workState={data.workState}
            />
        ) : (
            <FarmTodayViewTracker
                dataStatus={data.status}
                hasNextTask={false}
            />
        );

    if (data.status === 'unavailable') {
        return (
            <main className="mx-auto w-full max-w-5xl space-y-3 px-3 py-3 sm:p-4">
                {viewTracker}
                <header className="flex min-h-11 min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">{heading}</div>
                    {headerActions ? (
                        <div className="flex shrink-0 gap-1">
                            {headerActions}
                        </div>
                    ) : null}
                </header>
                <FarmTodayUnavailableState />
                <FarmTodayTools />
            </main>
        );
    }

    if (data.status === 'noFarm') {
        return (
            <main className="mx-auto w-full max-w-5xl space-y-3 px-3 py-3 sm:p-4">
                {viewTracker}
                <header className="flex min-h-11 min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">{heading}</div>
                    {headerActions ? (
                        <div className="flex shrink-0 gap-1">
                            {headerActions}
                        </div>
                    ) : null}
                </header>
                <FarmTodayNoFarmState />
                <FarmTodayTools />
            </main>
        );
    }

    const focusKeys = new Set(data.focusQueue.map((task) => task.key));
    const attentionItems = data.attentionItems.filter(
        ({ task }) => !focusKeys.has(task.key),
    );
    const nextTask = data.focusQueue[0];
    const taskGroups = groupTasks(data.focusQueue);
    const partialNotice =
        data.status === 'partial' ? (
            <Alert
                className="items-start"
                color="warning"
                startDecorator={<Warning aria-hidden className="size-4" />}
            >
                <div>
                    <span className="font-medium">
                        Prikazujemo dostupne podatke.
                    </span>{' '}
                    Brojevi sa znakom ≥ najmanje su potvrđene vrijednosti.
                </div>
            </Alert>
        ) : null;

    return (
        <main className="mx-auto w-full max-w-5xl min-w-0 space-y-3 px-3 py-3 sm:p-4">
            {viewTracker}
            <header className="flex min-h-11 min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">{heading}</div>
                {headerActions ? (
                    <div className="flex shrink-0 gap-1">{headerActions}</div>
                ) : null}
            </header>

            <FarmTodaySummary summary={data.summary} />

            {taskGroups.length > 0 ? (
                <section
                    aria-labelledby="farm-today-work-title"
                    className="space-y-2"
                >
                    <h2 className="sr-only" id="farm-today-work-title">
                        Današnji zadaci
                    </h2>
                    <Stack spacing={4}>
                        {taskGroups.map((group, groupIndex) => {
                            const groupTitleId = `farm-today-task-group-${groupIndex}`;

                            return (
                                <section
                                    aria-labelledby={groupTitleId}
                                    className="space-y-2"
                                    key={group.key}
                                >
                                    <div className="flex min-w-0 items-center justify-between gap-3">
                                        <h3
                                            className="inline-flex min-h-9 min-w-0 items-center gap-1.5 rounded-md bg-primary/10 px-2.5 text-base font-bold text-primary [overflow-wrap:anywhere]"
                                            id={groupTitleId}
                                        >
                                            <MapPin
                                                aria-hidden
                                                className="size-4 shrink-0"
                                            />
                                            {group.label}
                                        </h3>
                                        <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                                            {group.tasks.length}{' '}
                                            {group.tasks.length === 1
                                                ? 'zadatak'
                                                : 'zadataka'}
                                        </span>
                                    </div>
                                    <Stack spacing={2}>
                                        {group.tasks.map((task) => (
                                            <FarmTodayTaskCard
                                                actionContext={
                                                    taskActionContext
                                                }
                                                emphasis={
                                                    task.key === nextTask?.key
                                                        ? 'next'
                                                        : 'standard'
                                                }
                                                key={task.key}
                                                task={task}
                                            />
                                        ))}
                                    </Stack>
                                </section>
                            );
                        })}
                    </Stack>
                </section>
            ) : null}

            {partialNotice}

            {!nextTask ? (
                <FarmTodayAvailableStatePanel
                    completed={data.summary.completed}
                    dateKey={data.dateKey}
                    pendingVerification={data.summary.pendingVerification}
                    workState={data.workState}
                />
            ) : null}

            {attentionItems.length > 0 ? (
                <section
                    aria-labelledby="farm-today-attention-title"
                    className="space-y-2"
                >
                    <div>
                        <h2
                            className="text-sm font-semibold"
                            id="farm-today-attention-title"
                        >
                            Treba pažnju
                        </h2>
                        <Typography level="body3">
                            Zadaci koji čekaju potvrdu ili zahtijevaju provjeru.
                        </Typography>
                    </div>
                    <Stack spacing={2}>
                        {attentionItems.map(({ task }) => (
                            <FarmTodayTaskCard
                                actionContext={taskActionContext}
                                key={task.key}
                                task={task}
                            />
                        ))}
                    </Stack>
                </section>
            ) : null}

            <FarmTodayTools />
        </main>
    );
}
