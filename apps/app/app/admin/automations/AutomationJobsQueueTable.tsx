import { Button } from '@gredice/ui/Button';
import { Card, CardHeader, CardOverflow, CardTitle } from '@gredice/ui/Card';
import { LoaderSpinner } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { KnownPages } from '../../../src/KnownPages';
import {
    AutomationRunsCompactTable,
    type AutomationRunsCompactTableRow,
} from './AutomationRunsCompactTable';
import { automationRunSourceLabel } from './presentation';
import type { AutomationRunListItem } from './types';

function queueTiming(run: AutomationRunListItem) {
    if (run.status === 'queued' || run.status === 'retrying') {
        return { timeLabel: 'Sljedeće', timeValue: run.nextRunAt };
    }

    if (run.status === 'running') {
        return { timeLabel: 'Zaključano', timeValue: run.lockedAt };
    }

    if (run.completedAt) {
        return { timeLabel: 'Završeno', timeValue: run.completedAt };
    }

    return { timeLabel: 'Kreirano', timeValue: run.createdAt };
}

function queueRunToTableRow(
    run: AutomationRunListItem,
): AutomationRunsCompactTableRow {
    const timing = queueTiming(run);

    return {
        id: run.id,
        title: `#${run.id} ${run.automationDefinitionName}`,
        href: KnownPages.Automation(run.automationDefinitionId),
        subtitle: run.automationDefinitionKey,
        status: run.status,
        dryRun: run.dryRun,
        sourceLabel: automationRunSourceLabel(run.source),
        sourceDetail: run.parentRunId ? `Roditelj #${run.parentRunId}` : null,
        attempt: run.attempt,
        maxAttempts: run.maxAttempts,
        timeLabel: timing.timeLabel,
        timeValue: timing.timeValue,
        errorMessage: run.errorMessage,
    };
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
    const rows = runs.map(queueRunToTableRow);

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
                <AutomationRunsCompactTable
                    rows={rows}
                    emptyMessage="Nema poslova za odabrane filtere."
                />

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
