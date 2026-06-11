import { Button } from '@gredice/ui/Button';
import { Card, CardHeader, CardOverflow, CardTitle } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LoaderSpinner } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { KnownPages } from '../../../src/KnownPages';
import { AutomationRunStatusIndicator } from './AutomationStatusIndicator';
import type { AutomationRunListItem } from './types';

function sourceLabel(source: AutomationRunListItem['source']) {
    switch (source) {
        case 'event':
            return 'Event';
        case 'manual':
            return 'Ručno';
        case 'schedule':
            return 'Raspored';
        case 'test':
            return 'Test';
        case 'replay':
            return 'Ponovljeno';
    }
}

function DateTimeValue({ value }: { value: string | null }) {
    if (!value) {
        return <span>-</span>;
    }

    return <LocalDateTime>{value}</LocalDateTime>;
}

function QueueTiming({ run }: { run: AutomationRunListItem }) {
    if (run.status === 'queued' || run.status === 'retrying') {
        return (
            <DetailItem label="Sljedeće">
                <LocalDateTime>{run.nextRunAt}</LocalDateTime>
            </DetailItem>
        );
    }

    if (run.status === 'running') {
        return (
            <DetailItem label="Zaključano">
                <DateTimeValue value={run.lockedAt} />
                {run.lockedBy ? (
                    <Typography
                        level="body3"
                        className="break-all text-muted-foreground"
                    >
                        {run.lockedBy}
                    </Typography>
                ) : null}
            </DetailItem>
        );
    }

    if (run.completedAt) {
        return (
            <DetailItem label="Završeno">
                <LocalDateTime>{run.completedAt}</LocalDateTime>
            </DetailItem>
        );
    }

    return <DetailItem label="Obrada">-</DetailItem>;
}

function DetailItem({
    children,
    label,
}: {
    children: ReactNode;
    label: string;
}) {
    return (
        <div className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {label}
            </dt>
            <dd className="mt-1 min-w-0 break-words text-sm">{children}</dd>
        </div>
    );
}

export function AutomationJobsQueueList({
    hasMore,
    isFetching,
    isFetchingNextPage,
    loadMore,
    runs,
}: {
    hasMore: boolean;
    isFetching: boolean;
    isFetchingNextPage: boolean;
    loadMore: () => void;
    runs: AutomationRunListItem[];
}) {
    return (
        <Card className="h-full">
            <CardHeader>
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <Stack spacing={1} className="min-w-0">
                        <CardTitle>Red poslova</CardTitle>
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            Automatizacijski poslovi s trenutnim statusom,
                            pokušajima i podacima za obradu.
                        </Typography>
                    </Stack>
                    {isFetching && !isFetchingNextPage ? (
                        <Row
                            spacing={1}
                            className="shrink-0 items-center text-muted-foreground"
                        >
                            <LoaderSpinner className="size-4 animate-spin" />
                            <Typography level="body3">Osvježavanje</Typography>
                        </Row>
                    ) : null}
                </div>
            </CardHeader>
            <CardOverflow>
                {runs.length === 0 ? (
                    <div className="p-4">
                        <NoDataPlaceholder>
                            Nema poslova za odabrane filtere.
                        </NoDataPlaceholder>
                    </div>
                ) : (
                    <ul className="divide-y">
                        {runs.map((run) => (
                            <li key={run.id} className="p-4">
                                <Stack spacing={3}>
                                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <Stack spacing={1} className="min-w-0">
                                            <Link
                                                href={KnownPages.Automation(
                                                    run.automationDefinitionId,
                                                )}
                                                className="font-medium text-primary hover:underline"
                                            >
                                                #{run.id}{' '}
                                                {run.automationDefinitionName}
                                            </Link>
                                            <Typography
                                                level="body3"
                                                className="break-all text-muted-foreground"
                                            >
                                                {run.automationDefinitionKey}
                                            </Typography>
                                            {run.parentRunId ? (
                                                <Typography
                                                    level="body3"
                                                    className="text-muted-foreground"
                                                >
                                                    Roditelj #{run.parentRunId}
                                                </Typography>
                                            ) : null}
                                        </Stack>
                                        <Stack
                                            spacing={1}
                                            className="items-start sm:items-end"
                                        >
                                            <AutomationRunStatusIndicator
                                                status={run.status}
                                            />
                                            {run.dryRun ? (
                                                <Chip
                                                    size="sm"
                                                    color="info"
                                                    variant="soft"
                                                >
                                                    Probno
                                                </Chip>
                                            ) : null}
                                        </Stack>
                                    </div>

                                    {run.errorMessage ? (
                                        <Typography
                                            level="body3"
                                            className="break-words rounded-md bg-red-50 p-2 text-red-700 dark:bg-red-950 dark:text-red-300"
                                        >
                                            {run.errorMessage}
                                        </Typography>
                                    ) : null}

                                    <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                        <DetailItem label="Izvor">
                                            <Stack spacing={1}>
                                                <Chip size="sm" variant="soft">
                                                    {sourceLabel(run.source)}
                                                </Chip>
                                                <span>
                                                    {run.sourceEventType ?? '-'}
                                                </span>
                                                <Typography
                                                    level="body3"
                                                    className="break-all text-muted-foreground"
                                                >
                                                    {run.sourceAggregateId ??
                                                        '-'}
                                                </Typography>
                                            </Stack>
                                        </DetailItem>
                                        <DetailItem label="Pokušaji">
                                            {run.attempt} / {run.maxAttempts}
                                        </DetailItem>
                                        <QueueTiming run={run} />
                                        <DetailItem label="Kreirano">
                                            <LocalDateTime>
                                                {run.createdAt}
                                            </LocalDateTime>
                                        </DetailItem>
                                        <DetailItem label="Ažurirano">
                                            <LocalDateTime>
                                                {run.updatedAt}
                                            </LocalDateTime>
                                        </DetailItem>
                                        <DetailItem label="Početak">
                                            <DateTimeValue
                                                value={run.startedAt}
                                            />
                                        </DetailItem>
                                    </dl>
                                </Stack>
                            </li>
                        ))}
                    </ul>
                )}

                {hasMore ? (
                    <div className="border-t p-4">
                        <Button
                            type="button"
                            variant="outlined"
                            color="neutral"
                            fullWidth
                            loading={isFetchingNextPage}
                            onClick={loadMore}
                        >
                            Učitaj još
                        </Button>
                    </div>
                ) : null}
            </CardOverflow>
        </Card>
    );
}
