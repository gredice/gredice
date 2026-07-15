import { Alert } from '@gredice/ui/Alert';
import { Warning } from '@gredice/ui/icons';
import { List } from '@gredice/ui/List';
import { Typography } from '@gredice/ui/Typography';
import type { ReactNode } from 'react';
import {
    FarmTodayAvailableStatePanel,
    FarmTodayNoFarmState,
    FarmTodayUnavailableState,
} from './FarmTodayStatePanel';
import { FarmTodaySummary } from './FarmTodaySummary';
import { FarmTodayTaskLink } from './FarmTodayTaskLink';
import { FarmTodayTools } from './FarmTodayTools';
import type { FarmTodayData } from './farmTodayModel';

type FarmTodayViewProps = {
    data: FarmTodayData;
    headerActions?: ReactNode;
    heading: ReactNode;
};

export function FarmTodayView({
    data,
    headerActions,
    heading,
}: FarmTodayViewProps) {
    if (data.status === 'unavailable') {
        return (
            <main className="mx-auto w-full max-w-5xl space-y-3 px-3 py-3 sm:p-4">
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
    const remainingTasks = data.focusQueue.slice(1);
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
            <header className="flex min-h-11 min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">{heading}</div>
                {headerActions ? (
                    <div className="flex shrink-0 gap-1">{headerActions}</div>
                ) : null}
            </header>

            <FarmTodaySummary summary={data.summary} />

            {nextTask ? (
                <section aria-labelledby="farm-today-focus-title">
                    <h2 className="sr-only" id="farm-today-focus-title">
                        Fokus
                    </h2>
                    <List variant="outlined">
                        <FarmTodayTaskLink emphasis="next" task={nextTask} />
                    </List>
                </section>
            ) : null}

            {nextTask ? partialNotice : null}

            {remainingTasks.length > 0 ? (
                <section
                    aria-labelledby="farm-today-queue-title"
                    className="space-y-2"
                >
                    <h2
                        className="text-sm font-semibold"
                        id="farm-today-queue-title"
                    >
                        Nakon toga
                    </h2>
                    <List variant="outlined">
                        {remainingTasks.map((task) => (
                            <FarmTodayTaskLink key={task.key} task={task} />
                        ))}
                    </List>
                </section>
            ) : null}

            {!nextTask ? partialNotice : null}

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
                    <List variant="outlined">
                        {attentionItems.map(({ task }) => (
                            <FarmTodayTaskLink key={task.key} task={task} />
                        ))}
                    </List>
                </section>
            ) : null}

            <FarmTodayTools />
        </main>
    );
}
