import { Card, CardHeader, CardOverflow, CardTitle } from '@gredice/ui/Card';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { useMemo } from 'react';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { KnownPages } from '../../../src/KnownPages';
import {
    AutomationDefinitionStatusIndicator,
    AutomationRunStatusIndicator,
} from './AutomationStatusIndicator';
import type {
    AutomationDefinitionListItem,
    AutomationRunListItem,
} from './types';

function latestRunsByDefinition(runs: AutomationRunListItem[]) {
    const latestRuns = new Map<number, AutomationRunListItem>();

    for (const run of runs) {
        if (!latestRuns.has(run.automationDefinitionId)) {
            latestRuns.set(run.automationDefinitionId, run);
        }
    }

    return latestRuns;
}

function loadedFailedRunsByDefinition(runs: AutomationRunListItem[]) {
    const failedRuns = new Map<number, number>();

    for (const run of runs) {
        if (run.status !== 'failed') {
            continue;
        }

        failedRuns.set(
            run.automationDefinitionId,
            (failedRuns.get(run.automationDefinitionId) ?? 0) + 1,
        );
    }

    return failedRuns;
}

export function AutomationDefinitionsList({
    definitions,
    runs,
}: {
    definitions: AutomationDefinitionListItem[];
    runs: AutomationRunListItem[];
}) {
    const latestRuns = useMemo(() => latestRunsByDefinition(runs), [runs]);
    const failedRuns = useMemo(
        () => loadedFailedRunsByDefinition(runs),
        [runs],
    );

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>Definicije</CardTitle>
                <Typography level="body3" className="text-muted-foreground">
                    Aktivne automatizacije i njihova zadnja učitana izvođenja.
                </Typography>
            </CardHeader>
            <CardOverflow>
                {definitions.length === 0 ? (
                    <div className="p-4">
                        <NoDataPlaceholder>
                            Nema automatizacija za odabrane filtre.
                        </NoDataPlaceholder>
                    </div>
                ) : (
                    <ul className="divide-y">
                        {definitions.map((definition) => {
                            const latestRun = latestRuns.get(definition.id);
                            const failedCount =
                                failedRuns.get(definition.id) ?? 0;

                            return (
                                <li key={definition.id} className="p-4">
                                    <Stack spacing={3}>
                                        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <Stack
                                                spacing={1}
                                                className="min-w-0"
                                            >
                                                <Link
                                                    href={KnownPages.Automation(
                                                        definition.id,
                                                    )}
                                                    className="truncate font-medium text-primary hover:underline"
                                                >
                                                    {definition.name}
                                                </Link>
                                                <Typography
                                                    level="body3"
                                                    className="break-all text-muted-foreground"
                                                >
                                                    {definition.key}
                                                </Typography>
                                            </Stack>
                                            <AutomationDefinitionStatusIndicator
                                                status={definition.status}
                                            />
                                        </div>

                                        <dl className="grid gap-2 text-sm">
                                            <div className="grid gap-1">
                                                <dt className="text-muted-foreground">
                                                    Okidač
                                                </dt>
                                                <dd>
                                                    {definition.triggerSummary}
                                                </dd>
                                            </div>
                                            <div className="grid gap-1">
                                                <dt className="text-muted-foreground">
                                                    Akcije
                                                </dt>
                                                <dd>
                                                    {definition.actionSummary}
                                                </dd>
                                            </div>
                                        </dl>

                                        <Row
                                            spacing={3}
                                            className="flex-wrap items-center text-sm"
                                        >
                                            {latestRun ? (
                                                <>
                                                    <AutomationRunStatusIndicator
                                                        status={
                                                            latestRun.status
                                                        }
                                                    />
                                                    <LocalDateTime>
                                                        {latestRun.createdAt}
                                                    </LocalDateTime>
                                                </>
                                            ) : (
                                                <Typography
                                                    level="body3"
                                                    className="text-muted-foreground"
                                                >
                                                    Nema izvođenja
                                                </Typography>
                                            )}
                                            {failedCount > 0 ? (
                                                <Typography
                                                    level="body3"
                                                    className="text-red-700 dark:text-red-300"
                                                >
                                                    Greške: {failedCount}
                                                </Typography>
                                            ) : null}
                                            <Typography
                                                level="body3"
                                                className="text-muted-foreground"
                                            >
                                                Ažurirano{' '}
                                                <LocalDateTime>
                                                    {definition.updatedAt}
                                                </LocalDateTime>
                                            </Typography>
                                        </Row>
                                    </Stack>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </CardOverflow>
        </Card>
    );
}
