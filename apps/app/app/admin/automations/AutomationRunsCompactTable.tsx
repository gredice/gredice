'use client';

import type { AutomationRunStatus } from '@gredice/storage';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Table } from '@gredice/ui/Table';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import type { Route } from 'next';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { AutomationRunStatusIndicator } from './AutomationStatusIndicator';

export type AutomationRunsCompactTableRow = {
    id: number;
    title: string;
    href?: Route;
    subtitle?: string | null;
    status: AutomationRunStatus;
    dryRun: boolean;
    sourceLabel?: string | null;
    sourceDetail?: string | null;
    attempt: number;
    maxAttempts: number;
    timeLabel: string;
    timeValue: string | null;
    timeFallback?: string;
    secondaryTime?: string | null;
    errorMessage?: string | null;
};

function TimeValue({
    fallback = '-',
    label,
    value,
}: {
    fallback?: string;
    label: string;
    value: string | null;
}) {
    return (
        <span>
            {label} {value ? <LocalDateTime>{value}</LocalDateTime> : fallback}
        </span>
    );
}

export function AutomationRunsCompactTable({
    emptyMessage,
    onRunSelect,
    rows,
    selectedRunId,
}: {
    emptyMessage: string;
    onRunSelect?: (runId: number) => void;
    rows: AutomationRunsCompactTableRow[];
    selectedRunId?: number | null;
}) {
    return (
        <Table>
            <Table.Header>
                <Table.Row className="hover:bg-transparent">
                    <Table.Head className="h-9 px-3 py-2 text-xs uppercase tracking-wide">
                        Posao
                    </Table.Head>
                    <Table.Head className="h-9 px-3 py-2 text-xs uppercase tracking-wide">
                        Status
                    </Table.Head>
                    <Table.Head className="h-9 px-3 py-2 text-xs uppercase tracking-wide">
                        Izvor
                    </Table.Head>
                    <Table.Head className="h-9 px-3 py-2 text-xs uppercase tracking-wide">
                        Pokušaj
                    </Table.Head>
                    <Table.Head className="h-9 px-3 py-2 text-xs uppercase tracking-wide">
                        Vrijeme
                    </Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {rows.length === 0 ? (
                    <Table.Row>
                        <Table.Cell colSpan={5}>
                            <NoDataPlaceholder>
                                {emptyMessage}
                            </NoDataPlaceholder>
                        </Table.Cell>
                    </Table.Row>
                ) : null}
                {rows.map((row) => {
                    const isSelected = selectedRunId === row.id;

                    return (
                        <Table.Row
                            key={row.id}
                            className={cx(isSelected && 'bg-muted/70')}
                        >
                            <Table.Cell className="min-w-72 px-3 py-2 text-sm">
                                <div className="grid min-w-0 gap-1">
                                    {onRunSelect ? (
                                        <button
                                            type="button"
                                            aria-pressed={isSelected}
                                            className="min-w-0 truncate text-left font-medium text-primary hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                                            onClick={() => onRunSelect(row.id)}
                                        >
                                            {row.title}
                                        </button>
                                    ) : row.href ? (
                                        <Link
                                            href={row.href}
                                            className="min-w-0 truncate font-medium text-primary hover:underline"
                                        >
                                            {row.title}
                                        </Link>
                                    ) : (
                                        <span className="min-w-0 truncate font-medium">
                                            {row.title}
                                        </span>
                                    )}
                                    {row.subtitle ? (
                                        <Typography
                                            level="body3"
                                            className="truncate text-muted-foreground"
                                        >
                                            {row.subtitle}
                                        </Typography>
                                    ) : null}
                                    {row.errorMessage ? (
                                        <Typography
                                            level="body3"
                                            className="line-clamp-2 rounded-md bg-red-50 px-2 py-1 text-red-700 dark:bg-red-950 dark:text-red-300"
                                        >
                                            {row.errorMessage}
                                        </Typography>
                                    ) : null}
                                </div>
                            </Table.Cell>
                            <Table.Cell className="px-3 py-2 text-sm">
                                <div className="flex min-w-36 flex-wrap items-center gap-2">
                                    <AutomationRunStatusIndicator
                                        className="text-xs"
                                        status={row.status}
                                    />
                                    {row.dryRun ? (
                                        <Chip
                                            size="sm"
                                            color="info"
                                            variant="soft"
                                        >
                                            Probno
                                        </Chip>
                                    ) : null}
                                </div>
                            </Table.Cell>
                            <Table.Cell className="px-3 py-2 text-sm">
                                <div className="grid min-w-32 gap-0.5">
                                    <span>{row.sourceLabel ?? '-'}</span>
                                    {row.sourceDetail ? (
                                        <Typography
                                            level="body3"
                                            className="truncate text-muted-foreground"
                                        >
                                            {row.sourceDetail}
                                        </Typography>
                                    ) : null}
                                </div>
                            </Table.Cell>
                            <Table.Cell className="whitespace-nowrap px-3 py-2 text-sm">
                                {row.attempt} / {row.maxAttempts}
                            </Table.Cell>
                            <Table.Cell className="px-3 py-2 text-sm">
                                <div className="grid min-w-44 gap-0.5 text-muted-foreground">
                                    <TimeValue
                                        fallback={row.timeFallback}
                                        label={row.timeLabel}
                                        value={row.timeValue}
                                    />
                                    {row.secondaryTime ? (
                                        <Typography level="body3">
                                            {row.secondaryTime}
                                        </Typography>
                                    ) : null}
                                </div>
                            </Table.Cell>
                        </Table.Row>
                    );
                })}
            </Table.Body>
        </Table>
    );
}
