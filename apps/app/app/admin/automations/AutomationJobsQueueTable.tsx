import { Button } from '@gredice/ui/Button';
import { Card, CardHeader, CardOverflow, CardTitle } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LoaderSpinner } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
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
            <>
                Sljedeće <LocalDateTime>{run.nextRunAt}</LocalDateTime>
            </>
        );
    }

    if (run.status === 'running') {
        return (
            <>
                Zaključano <DateTimeValue value={run.lockedAt} />
            </>
        );
    }

    if (run.completedAt) {
        return (
            <>
                Završeno <LocalDateTime>{run.completedAt}</LocalDateTime>
            </>
        );
    }

    return (
        <>
            Kreirano <LocalDateTime>{run.createdAt}</LocalDateTime>
        </>
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
                            pokušajima i ključnim vremenom obrade.
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
                            <li key={run.id} className="px-4 py-3">
                                <div className="grid min-w-0 gap-1.5">
                                    <div className="flex min-w-0 items-start justify-between gap-3">
                                        <Link
                                            href={KnownPages.Automation(
                                                run.automationDefinitionId,
                                            )}
                                            className="min-w-0 truncate font-medium text-primary hover:underline"
                                        >
                                            #{run.id}{' '}
                                            {run.automationDefinitionName}
                                        </Link>
                                        <div className="flex shrink-0 items-center gap-2">
                                            <AutomationRunStatusIndicator
                                                className="text-xs sm:text-sm"
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
                                        </div>
                                    </div>

                                    {run.errorMessage ? (
                                        <Typography
                                            level="body3"
                                            className="line-clamp-2 rounded-md bg-red-50 p-2 text-red-700 dark:bg-red-950 dark:text-red-300"
                                        >
                                            {run.errorMessage}
                                        </Typography>
                                    ) : null}

                                    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                        <span className="min-w-0 max-w-full truncate">
                                            {run.automationDefinitionKey}
                                        </span>
                                        <span>{sourceLabel(run.source)}</span>
                                        <span>
                                            Pokušaj {run.attempt} /{' '}
                                            {run.maxAttempts}
                                        </span>
                                        <span>
                                            <QueueTiming run={run} />
                                        </span>
                                        {run.parentRunId ? (
                                            <span>
                                                Roditelj #{run.parentRunId}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
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
