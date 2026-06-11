'use client';

import type {
    AutomationJsonObject,
    AutomationModuleKind,
    AutomationRunStatus,
    AutomationStepStatus,
} from '@gredice/storage';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { AutomationSlidePanel } from './AutomationSlidePanel';
import {
    AutomationRunStatusIndicator,
    AutomationStepStatusIndicator,
    isAutomationRunLive,
} from './AutomationStatusIndicator';
import { AutomationRunRetryControls } from './AutomationTestPanel';
import {
    automationModuleKindLabel,
    automationRunStatusMeta,
} from './presentation';

export type AutomationRunStatusFilter =
    | 'withoutSkipped'
    | 'all'
    | AutomationRunStatus;

export type AutomationRunsTableRun = {
    run: {
        id: number;
        status: AutomationRunStatus;
        dryRun: boolean;
        attempt: number;
        maxAttempts: number;
        sourceEventType: string | null;
        sourceAggregateId: string | null;
        input: AutomationJsonObject;
        output: AutomationJsonObject;
        errorMessage: string | null;
        startedAt: string | null;
        completedAt: string | null;
        createdAt: string;
    };
    steps: Array<{
        id: number;
        nodeId: string;
        moduleKey: string;
        moduleKind: AutomationModuleKind;
        status: AutomationStepStatus;
        input: AutomationJsonObject;
        output: AutomationJsonObject;
        errorMessage: string | null;
        startedAt: string | null;
        completedAt: string | null;
        createdAt: string;
    }>;
};

function formatDuration(startedAt: string | null, completedAt: string | null) {
    if (!startedAt || !completedAt) {
        return '-';
    }

    const startedAtMs = new Date(startedAt).getTime();
    const completedAtMs = new Date(completedAt).getTime();

    if (Number.isNaN(startedAtMs) || Number.isNaN(completedAtMs)) {
        return '-';
    }

    return `${Math.max(0, completedAtMs - startedAtMs)} ms`;
}

function JsonPreview({ value }: { value: unknown }) {
    return (
        <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(value, null, 2)}
        </pre>
    );
}

function DateTimeValue({ value }: { value: string | null }) {
    if (!value) {
        return <span>-</span>;
    }

    return <LocalDateTime>{value}</LocalDateTime>;
}

function DetailItem({
    children,
    label,
}: {
    children: ReactNode;
    label: string;
}) {
    return (
        <>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words">{children}</dd>
        </>
    );
}

function ListDetailItem({
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
            <dd className="mt-1 min-w-0 break-words">{children}</dd>
        </div>
    );
}

export function AutomationRunsTable({
    currentStatusFilter,
    runs,
    statusOptions,
}: {
    currentStatusFilter: AutomationRunStatusFilter;
    runs: AutomationRunsTableRun[];
    statusOptions: AutomationRunStatus[];
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
    const selectedRun = useMemo(
        () => runs.find(({ run }) => run.id === selectedRunId) ?? null,
        [runs, selectedRunId],
    );
    const hasLiveRuns = useMemo(
        () => runs.some(({ run }) => isAutomationRunLive(run.status)),
        [runs],
    );
    const filterItems = useMemo<
        Array<{ value: AutomationRunStatusFilter; label: string }>
    >(
        () => [
            { value: 'withoutSkipped', label: 'Svi osim preskočenih' },
            { value: 'all', label: 'Svi statusi' },
            ...statusOptions.map((status) => ({
                value: status,
                label: automationRunStatusMeta(status).label,
            })),
        ],
        [statusOptions],
    );

    function updateStatusFilter(nextFilter: AutomationRunStatusFilter) {
        const nextSearchParams = new URLSearchParams(searchParams.toString());
        if (nextFilter === 'withoutSkipped') {
            nextSearchParams.delete('runStatus');
        } else {
            nextSearchParams.set('runStatus', nextFilter);
        }

        const queryString = nextSearchParams.toString();
        setSelectedRunId(null);
        router.replace(
            (queryString ? `${pathname}?${queryString}` : pathname) as Route,
        );
    }

    useEffect(() => {
        if (!hasLiveRuns) {
            return;
        }

        const intervalId = window.setInterval(() => {
            router.refresh();
        }, 7000);

        return () => window.clearInterval(intervalId);
    }, [hasLiveRuns, router]);

    return (
        <>
            <div className="min-w-0 overflow-hidden rounded-md border bg-background">
                <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
                    <Stack spacing={1}>
                        <Typography level="h5" component="h2">
                            Izvršavanja
                        </Typography>
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            Preskočena izvođenja su skrivena dok ih ne uključite
                            filtrom.
                        </Typography>
                    </Stack>
                    <SelectItems<AutomationRunStatusFilter>
                        className="w-full sm:w-64"
                        label="Status"
                        value={currentStatusFilter}
                        items={filterItems}
                        searchable={false}
                        onValueChange={updateStatusFilter}
                    />
                </div>
                {runs.length === 0 ? (
                    <div className="p-4">
                        <NoDataPlaceholder>
                            Automatizacija nema izvođenja za odabrani filter.
                        </NoDataPlaceholder>
                    </div>
                ) : (
                    <ul className="divide-y">
                        {runs.map(({ run, steps }) => (
                            <li key={run.id}>
                                <button
                                    type="button"
                                    aria-pressed={selectedRunId === run.id}
                                    className={cx(
                                        'grid w-full gap-3 p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                                        selectedRunId === run.id &&
                                            'bg-muted/70',
                                    )}
                                    onClick={() => setSelectedRunId(run.id)}
                                >
                                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <Stack spacing={1} className="min-w-0">
                                            <Row
                                                spacing={2}
                                                className="flex-wrap items-center"
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
                                            </Row>
                                            <Typography
                                                level="body3"
                                                className="text-muted-foreground"
                                            >
                                                {steps.length} koraka
                                            </Typography>
                                        </Stack>
                                        <Stack
                                            spacing={1}
                                            className="text-muted-foreground sm:items-end"
                                        >
                                            <LocalDateTime>
                                                {run.createdAt}
                                            </LocalDateTime>
                                            <Typography level="body3">
                                                {formatDuration(
                                                    run.startedAt,
                                                    run.completedAt,
                                                )}
                                            </Typography>
                                        </Stack>
                                    </div>

                                    <dl className="grid gap-3 text-sm sm:grid-cols-3">
                                        <ListDetailItem label="Tip eventa">
                                            {run.sourceEventType ?? '-'}
                                        </ListDetailItem>
                                        <ListDetailItem label="Agregat">
                                            {run.sourceAggregateId ?? '-'}
                                        </ListDetailItem>
                                        <ListDetailItem label="Pokušaj">
                                            {run.attempt} / {run.maxAttempts}
                                        </ListDetailItem>
                                    </dl>

                                    {run.errorMessage ? (
                                        <Typography
                                            level="body3"
                                            className="break-words rounded-md bg-red-50 p-2 text-red-700 dark:bg-red-950 dark:text-red-300"
                                        >
                                            {run.errorMessage}
                                        </Typography>
                                    ) : null}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <AutomationSlidePanel
                open={Boolean(selectedRun)}
                title="Detalji izvođenja"
                description={
                    selectedRun
                        ? `#${selectedRun.run.id} · ${
                              automationRunStatusMeta(selectedRun.run.status)
                                  .label
                          }`
                        : undefined
                }
                widthClassName="max-w-[560px]"
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedRunId(null);
                    }
                }}
            >
                {selectedRun ? (
                    <Stack spacing={5}>
                        <Stack spacing={3}>
                            <Row spacing={1} className="flex-wrap">
                                <AutomationRunStatusIndicator
                                    status={selectedRun.run.status}
                                />
                                {selectedRun.run.dryRun ? (
                                    <Chip size="sm" color="info" variant="soft">
                                        Probno
                                    </Chip>
                                ) : null}
                            </Row>
                            <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
                                <DetailItem label="Tip eventa">
                                    {selectedRun.run.sourceEventType ?? '-'}
                                </DetailItem>
                                <DetailItem label="Agregat">
                                    {selectedRun.run.sourceAggregateId ?? '-'}
                                </DetailItem>
                                <DetailItem label="Pokušaj">
                                    {selectedRun.run.attempt} /{' '}
                                    {selectedRun.run.maxAttempts}
                                </DetailItem>
                                <DetailItem label="Trajanje">
                                    {formatDuration(
                                        selectedRun.run.startedAt,
                                        selectedRun.run.completedAt,
                                    )}
                                </DetailItem>
                                <DetailItem label="Kreirano">
                                    <DateTimeValue
                                        value={selectedRun.run.createdAt}
                                    />
                                </DetailItem>
                                <DetailItem label="Početak">
                                    <DateTimeValue
                                        value={selectedRun.run.startedAt}
                                    />
                                </DetailItem>
                                <DetailItem label="Završetak">
                                    <DateTimeValue
                                        value={selectedRun.run.completedAt}
                                    />
                                </DetailItem>
                            </dl>
                            {selectedRun.run.errorMessage ? (
                                <Typography
                                    level="body2"
                                    className="text-red-700 dark:text-red-300"
                                >
                                    {selectedRun.run.errorMessage}
                                </Typography>
                            ) : null}
                            {selectedRun.run.status === 'failed' ? (
                                <AutomationRunRetryControls
                                    runId={selectedRun.run.id}
                                />
                            ) : null}
                        </Stack>

                        <Stack spacing={2}>
                            <Typography level="body2" semiBold>
                                Podaci izvođenja
                            </Typography>
                            <details>
                                <summary className="cursor-pointer text-sm font-medium">
                                    Ulaz
                                </summary>
                                <JsonPreview value={selectedRun.run.input} />
                            </details>
                            <details>
                                <summary className="cursor-pointer text-sm font-medium">
                                    Izlaz
                                </summary>
                                <JsonPreview value={selectedRun.run.output} />
                            </details>
                        </Stack>

                        <Stack spacing={3}>
                            <Typography level="body2" semiBold>
                                Koraci
                            </Typography>
                            {selectedRun.steps.length === 0 ? (
                                <Typography
                                    level="body3"
                                    className="text-muted-foreground"
                                >
                                    Nema zabilježenih koraka.
                                </Typography>
                            ) : null}
                            {selectedRun.steps.map((step) => (
                                <section
                                    key={step.id}
                                    className="rounded-md border bg-background p-3"
                                >
                                    <Stack spacing={2}>
                                        <Row spacing={2} className="flex-wrap">
                                            <Typography level="body2" semiBold>
                                                {step.nodeId}
                                            </Typography>
                                            <AutomationStepStatusIndicator
                                                status={step.status}
                                            />
                                            <Chip size="sm" variant="soft">
                                                {automationModuleKindLabel(
                                                    step.moduleKind,
                                                )}
                                            </Chip>
                                        </Row>
                                        <Typography
                                            level="body3"
                                            className="break-all text-muted-foreground"
                                        >
                                            {step.moduleKey}
                                        </Typography>
                                        {step.errorMessage ? (
                                            <Typography
                                                level="body3"
                                                className="text-red-700 dark:text-red-300"
                                            >
                                                {step.errorMessage}
                                            </Typography>
                                        ) : null}
                                        <details>
                                            <summary className="cursor-pointer text-xs font-medium">
                                                Ulaz
                                            </summary>
                                            <JsonPreview value={step.input} />
                                        </details>
                                        <details>
                                            <summary className="cursor-pointer text-xs font-medium">
                                                Izlaz
                                            </summary>
                                            <JsonPreview value={step.output} />
                                        </details>
                                    </Stack>
                                </section>
                            ))}
                        </Stack>
                    </Stack>
                ) : null}
            </AutomationSlidePanel>
        </>
    );
}
