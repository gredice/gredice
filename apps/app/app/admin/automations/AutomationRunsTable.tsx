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
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { AutomationRunStatusFilter } from './AutomationRunStatusFilter';
import {
    AutomationRunsCompactTable,
    type AutomationRunsCompactTableRow,
} from './AutomationRunsCompactTable';
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

export function AutomationRunsTable({
    runs,
    statusOptions,
}: {
    runs: AutomationRunsTableRun[];
    statusOptions: AutomationRunStatus[];
}) {
    const router = useRouter();
    const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
    const selectedRun = useMemo(
        () => runs.find(({ run }) => run.id === selectedRunId) ?? null,
        [runs, selectedRunId],
    );
    const hasLiveRuns = useMemo(
        () => runs.some(({ run }) => isAutomationRunLive(run.status)),
        [runs],
    );
    const tableRows = useMemo<AutomationRunsCompactTableRow[]>(
        () =>
            runs.map(({ run, steps }) => ({
                id: run.id,
                title: `#${run.id}`,
                subtitle: `${steps.length} koraka`,
                status: run.status,
                dryRun: run.dryRun,
                sourceLabel: run.sourceEventType,
                sourceDetail: run.sourceAggregateId,
                attempt: run.attempt,
                maxAttempts: run.maxAttempts,
                timeLabel: 'Kreirano',
                timeValue: run.createdAt,
                secondaryTime: formatDuration(run.startedAt, run.completedAt),
                errorMessage: run.errorMessage,
            })),
        [runs],
    );

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
                <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <Typography level="h5" component="h2">
                        Izvršavanja
                    </Typography>
                    <AutomationRunStatusFilter statusOptions={statusOptions} />
                </div>
                <AutomationRunsCompactTable
                    rows={tableRows}
                    emptyMessage="Automatizacija nema izvođenja za odabrani filter."
                    selectedRunId={selectedRunId}
                    onRunSelect={setSelectedRunId}
                />
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
