import type {
    AutomationRunSource,
    AutomationRunStatus,
    SelectAutomationRun,
} from '@gredice/storage';
import { Card, CardHeader, CardOverflow, CardTitle } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Table } from '@gredice/ui/Table';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { KnownPages } from '../../../src/KnownPages';
import { automationRunStatusMeta } from './presentation';

type AutomationJobQueueRun = Pick<
    SelectAutomationRun,
    | 'id'
    | 'automationDefinitionId'
    | 'automationDefinitionKey'
    | 'automationDefinitionName'
    | 'source'
    | 'sourceEventType'
    | 'sourceAggregateId'
    | 'parentRunId'
    | 'status'
    | 'dryRun'
    | 'attempt'
    | 'maxAttempts'
    | 'nextRunAt'
    | 'lockedAt'
    | 'lockedBy'
    | 'errorMessage'
    | 'startedAt'
    | 'completedAt'
    | 'createdAt'
    | 'updatedAt'
>;

function renderRunStatusChip(status: AutomationRunStatus) {
    const meta = automationRunStatusMeta(status);
    return (
        <Chip color={meta.color} size="sm" variant="soft">
            {meta.label}
        </Chip>
    );
}

function sourceLabel(source: AutomationRunSource) {
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
            return 'Replay';
    }
}

function renderDateTimeValue(value: Date | null) {
    if (!value) {
        return <span>-</span>;
    }

    return <LocalDateTime>{value}</LocalDateTime>;
}

function renderQueueTiming(run: AutomationJobQueueRun) {
    if (run.status === 'queued' || run.status === 'retrying') {
        return (
            <Stack spacing={1}>
                <Typography level="body3" className="text-muted-foreground">
                    Sljedeće
                </Typography>
                <LocalDateTime>{run.nextRunAt}</LocalDateTime>
            </Stack>
        );
    }

    if (run.status === 'running') {
        return (
            <Stack spacing={1}>
                <Typography level="body3" className="text-muted-foreground">
                    Zaključano
                </Typography>
                {renderDateTimeValue(run.lockedAt)}
                {run.lockedBy ? (
                    <Typography
                        level="body3"
                        className="break-all text-muted-foreground"
                    >
                        {run.lockedBy}
                    </Typography>
                ) : null}
            </Stack>
        );
    }

    if (run.completedAt) {
        return (
            <Stack spacing={1}>
                <Typography level="body3" className="text-muted-foreground">
                    Završeno
                </Typography>
                <LocalDateTime>{run.completedAt}</LocalDateTime>
            </Stack>
        );
    }

    return (
        <Typography level="body3" className="text-muted-foreground">
            -
        </Typography>
    );
}

export function AutomationJobsQueueTable({
    runs,
}: {
    runs: AutomationJobQueueRun[];
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Red poslova</CardTitle>
                <Typography level="body3" className="text-muted-foreground">
                    Automatizacijski poslovi s trenutnim statusom, pokušajima i
                    podacima za obradu.
                </Typography>
            </CardHeader>
            <CardOverflow>
                <div className="overflow-auto">
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Job</Table.Head>
                                <Table.Head>Status</Table.Head>
                                <Table.Head>Izvor</Table.Head>
                                <Table.Head>Pokušaji</Table.Head>
                                <Table.Head>Obrada</Table.Head>
                                <Table.Head>Vrijeme</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {runs.length === 0 ? (
                                <Table.Row>
                                    <Table.Cell colSpan={6}>
                                        <NoDataPlaceholder>
                                            Nema poslova za odabrane filtere.
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            ) : null}
                            {runs.map((run) => (
                                <Table.Row key={run.id}>
                                    <Table.Cell>
                                        <Stack spacing={1}>
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
                                                    Parent #{run.parentRunId}
                                                </Typography>
                                            ) : null}
                                        </Stack>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Stack spacing={1}>
                                            <Row
                                                spacing={1}
                                                className="flex-wrap"
                                            >
                                                {renderRunStatusChip(
                                                    run.status,
                                                )}
                                                {run.dryRun ? (
                                                    <Chip
                                                        size="sm"
                                                        color="info"
                                                        variant="soft"
                                                    >
                                                        Dry-run
                                                    </Chip>
                                                ) : null}
                                            </Row>
                                            {run.errorMessage ? (
                                                <Typography
                                                    level="body3"
                                                    className="max-w-80 break-words text-red-700 dark:text-red-300"
                                                >
                                                    {run.errorMessage}
                                                </Typography>
                                            ) : null}
                                        </Stack>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Stack spacing={1}>
                                            <Chip size="sm" variant="soft">
                                                {sourceLabel(run.source)}
                                            </Chip>
                                            <Typography level="body3">
                                                {run.sourceEventType ?? '-'}
                                            </Typography>
                                            <Typography
                                                level="body3"
                                                className="break-all text-muted-foreground"
                                            >
                                                {run.sourceAggregateId ?? '-'}
                                            </Typography>
                                        </Stack>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Typography level="body3">
                                            {run.attempt} / {run.maxAttempts}
                                        </Typography>
                                    </Table.Cell>
                                    <Table.Cell>
                                        {renderQueueTiming(run)}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Stack spacing={1}>
                                            <Typography
                                                level="body3"
                                                className="text-muted-foreground"
                                            >
                                                Kreirano
                                            </Typography>
                                            <LocalDateTime>
                                                {run.createdAt}
                                            </LocalDateTime>
                                            <Typography
                                                level="body3"
                                                className="text-muted-foreground"
                                            >
                                                Ažurirano
                                            </Typography>
                                            <LocalDateTime>
                                                {run.updatedAt}
                                            </LocalDateTime>
                                            {run.startedAt ? (
                                                <>
                                                    <Typography
                                                        level="body3"
                                                        className="text-muted-foreground"
                                                    >
                                                        Početak
                                                    </Typography>
                                                    <LocalDateTime>
                                                        {run.startedAt}
                                                    </LocalDateTime>
                                                </>
                                            ) : null}
                                        </Stack>
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                </div>
            </CardOverflow>
        </Card>
    );
}
