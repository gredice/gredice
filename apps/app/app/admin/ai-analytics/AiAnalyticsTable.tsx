'use client';

import { sanitizeRaisedBedAiMarkdown } from '@gredice/js/ai';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { ImageGallery } from '@gredice/ui/ImageGallery';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Markdown } from '@gredice/ui/Markdown';
import { Modal } from '@gredice/ui/Modal';
import { RaisedBedIcon } from '@gredice/ui/RaisedBedIcon';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import {
    estimateAiAnalysisCostUsd,
    formatAiCostUsd,
} from '../../../src/ai/aiAnalyticsCost';
import type { AiAnalyticsOperationType } from './aiAnalyticsPresentation';

export type AiAnalyticsRow = {
    id: number;
    createdAt: string;
    type: AiAnalyticsOperationType;
    typeLabel: string;
    raisedBedName: string;
    raisedBedPhysicalId: string | null;
    positionIndex: number | null;
    sourceEventType: string | null;
    sourceAggregateId: string | null;
    automationRunId: number | null;
    data: {
        markdown?: string | undefined;
        imageUrl?: string | undefined;
        imageUrls?: string[] | undefined;
        model?: string | null | undefined;
        inputTokens?: number | null | undefined;
        outputTokens?: number | null | undefined;
        totalTokens?: number | null | undefined;
        summary?: string | undefined;
        source?: string | undefined;
        imageCount?: number | null | undefined;
        proposalCount?: number | null | undefined;
        acceptedProposalCount?: number | null | undefined;
        requestCount?: number | null | undefined;
    } | null;
};

function formatTokens(value: number | undefined | null) {
    if (value == null) return '-';
    return value.toLocaleString('hr-HR');
}

function imageItems(row: AiAnalyticsRow) {
    const imageUrls = [
        ...(row.data?.imageUrls ?? []),
        row.data?.imageUrl ?? null,
    ].filter((url): url is string => Boolean(url?.trim()));
    const uniqueImageUrls = Array.from(new Set(imageUrls));

    return uniqueImageUrls.map((url, index) => ({
        src: url,
        alt: `Slika AI analize ${row.id}-${index + 1}`,
    }));
}

function RaisedBedCell({ row }: { row: AiAnalyticsRow }) {
    return (
        <div className="flex items-center gap-2">
            <RaisedBedIcon
                physicalId={row.raisedBedPhysicalId}
                containerClassName="h-8 min-w-8"
                className="size-7 text-muted-foreground"
                aria-label={
                    row.raisedBedPhysicalId
                        ? `Gredica ${row.raisedBedPhysicalId}`
                        : 'Gredica'
                }
            />
            <Stack spacing={0}>
                <Typography level="body2" semiBold>
                    {row.raisedBedName}
                </Typography>
                {row.positionIndex != null && (
                    <Typography level="body3" className="text-muted-foreground">
                        {`Polje ${row.positionIndex + 1}`}
                    </Typography>
                )}
            </Stack>
        </div>
    );
}

function AiAnalysisDetails({ row }: { row: AiAnalyticsRow }) {
    const images = imageItems(row);
    const markdown = row.data?.markdown?.trim();
    const summary = row.data?.summary?.trim();
    const generatedContent = markdown || summary;
    const sanitizedGeneratedContent = generatedContent
        ? sanitizeRaisedBedAiMarkdown(generatedContent)
        : '';
    const imageCount = row.data?.imageCount ?? images.length;

    return (
        <Stack spacing={4}>
            <Stack spacing={1} className="pr-6">
                <Typography level="h4" semiBold>
                    {row.typeLabel}
                </Typography>
                <RaisedBedCell row={row} />
            </Stack>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                <Stack spacing={0}>
                    <Typography level="body3">Tip</Typography>
                    <Typography level="body2">{row.typeLabel}</Typography>
                </Stack>
                <Stack spacing={0}>
                    <Typography level="body3">Model</Typography>
                    <Typography level="body2">
                        {row.data?.model ?? '-'}
                    </Typography>
                </Stack>
                <Stack spacing={0}>
                    <Typography level="body3">Tokeni</Typography>
                    <Typography level="body2">
                        {formatTokens(row.data?.totalTokens)}
                    </Typography>
                </Stack>
                <Stack spacing={0}>
                    <Typography level="body3">Trošak</Typography>
                    <Typography level="body2">
                        {formatAiCostUsd(estimateAiAnalysisCostUsd(row.data))}
                    </Typography>
                </Stack>
                <Stack spacing={0}>
                    <Typography level="body3">Datum</Typography>
                    <Typography level="body2">
                        <LocalDateTime>{row.createdAt}</LocalDateTime>
                    </Typography>
                </Stack>
            </div>

            {(row.data?.source ||
                row.data?.proposalCount != null ||
                row.data?.requestCount != null ||
                row.automationRunId != null) && (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    <Stack spacing={0}>
                        <Typography level="body3">Izvor</Typography>
                        <Typography level="body2">
                            {row.data?.source ?? row.sourceEventType ?? 'Ručno'}
                        </Typography>
                    </Stack>
                    <Stack spacing={0}>
                        <Typography level="body3">Prijedlozi</Typography>
                        <Typography level="body2">
                            {formatTokens(row.data?.proposalCount)}
                        </Typography>
                    </Stack>
                    <Stack spacing={0}>
                        <Typography level="body3">Zahtjevi</Typography>
                        <Typography level="body2">
                            {formatTokens(row.data?.requestCount)}
                        </Typography>
                    </Stack>
                    <Stack spacing={0}>
                        <Typography level="body3">Automation run</Typography>
                        <Typography level="body2">
                            {row.automationRunId
                                ? `#${row.automationRunId}`
                                : '-'}
                        </Typography>
                    </Stack>
                </div>
            )}

            <Stack spacing={2}>
                <Typography level="body2" semiBold>
                    Generirani sadržaj
                </Typography>
                {sanitizedGeneratedContent ? (
                    <Markdown className="rounded-md border bg-muted/20 p-3">
                        {sanitizedGeneratedContent}
                    </Markdown>
                ) : (
                    <NoDataPlaceholder>Nema sadržaja</NoDataPlaceholder>
                )}
            </Stack>

            <Stack spacing={2}>
                <Typography level="body2" semiBold>
                    Slike
                </Typography>
                {images.length > 0 ? (
                    <ImageGallery
                        images={images}
                        previewWidth={220}
                        previewHeight={150}
                        previewVariant="carousel"
                    />
                ) : (
                    <NoDataPlaceholder>
                        {imageCount > 0
                            ? `Analizirano slika: ${imageCount.toLocaleString(
                                  'hr-HR',
                              )}`
                            : 'Nema priloženih slika'}
                    </NoDataPlaceholder>
                )}
            </Stack>
        </Stack>
    );
}

export function AiAnalyticsTable({ rows }: { rows: AiAnalyticsRow[] }) {
    const [selectedRow, setSelectedRow] = useState<AiAnalyticsRow | null>(null);

    return (
        <>
            <Card>
                <CardOverflow>
                    {rows.length === 0 ? (
                        <div className="p-4">
                            <NoDataPlaceholder>
                                Nema AI operacija
                            </NoDataPlaceholder>
                        </div>
                    ) : (
                        <ul className="divide-y">
                            {rows.map((row) => (
                                <li key={row.id}>
                                    <button
                                        type="button"
                                        aria-label={`Otvori detalje AI analize ${row.typeLabel}`}
                                        className="grid w-full gap-3 px-3 py-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-4"
                                        onClick={() => setSelectedRow(row)}
                                    >
                                        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="min-w-0">
                                                <RaisedBedCell row={row} />
                                            </div>

                                            <div className="flex min-w-0 flex-col gap-2 lg:items-end">
                                                <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
                                                    <Chip size="sm">
                                                        {row.typeLabel}
                                                    </Chip>
                                                    <Chip size="sm">
                                                        {row.data?.model ?? '-'}
                                                    </Chip>
                                                </div>

                                                <div className="grid min-w-0 gap-x-4 gap-y-1 text-muted-foreground sm:grid-cols-2 lg:text-right">
                                                    <Typography level="body3">
                                                        Ulazni:{' '}
                                                        <span className="font-medium text-foreground tabular-nums">
                                                            {formatTokens(
                                                                row.data
                                                                    ?.inputTokens,
                                                            )}
                                                        </span>
                                                    </Typography>
                                                    <Typography level="body3">
                                                        Izlazni:{' '}
                                                        <span className="font-medium text-foreground tabular-nums">
                                                            {formatTokens(
                                                                row.data
                                                                    ?.outputTokens,
                                                            )}
                                                        </span>
                                                    </Typography>
                                                    <Typography level="body3">
                                                        Ukupno:{' '}
                                                        <span className="font-medium text-foreground tabular-nums">
                                                            {formatTokens(
                                                                row.data
                                                                    ?.totalTokens,
                                                            )}
                                                        </span>
                                                    </Typography>
                                                    <Typography level="body3">
                                                        Trošak:{' '}
                                                        <span className="font-medium text-foreground tabular-nums">
                                                            {formatAiCostUsd(
                                                                estimateAiAnalysisCostUsd(
                                                                    row.data,
                                                                ),
                                                            )}
                                                        </span>
                                                    </Typography>
                                                </div>

                                                <Typography
                                                    level="body3"
                                                    className="text-muted-foreground lg:text-right"
                                                >
                                                    Datum:{' '}
                                                    <span className="whitespace-nowrap">
                                                        <LocalDateTime>
                                                            {row.createdAt}
                                                        </LocalDateTime>
                                                    </span>
                                                </Typography>
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardOverflow>
            </Card>

            <Modal
                title="Detalji AI analize"
                open={Boolean(selectedRow)}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedRow(null);
                    }
                }}
                className="max-w-3xl"
            >
                {selectedRow && <AiAnalysisDetails row={selectedRow} />}
            </Modal>
        </>
    );
}
