'use client';

import { Card, CardOverflow } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { ImageGallery } from '@gredice/ui/ImageGallery';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Markdown } from '@gredice/ui/Markdown';
import { Modal } from '@gredice/ui/Modal';
import { RaisedBedIcon } from '@gredice/ui/RaisedBedIcon';
import { Stack } from '@gredice/ui/Stack';
import { Table } from '@gredice/ui/Table';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import {
    estimateAiAnalysisCostUsd,
    formatAiCostUsd,
} from '../../../src/ai/aiAnalyticsCost';

export type AiAnalyticsRow = {
    id: number;
    createdAt: string;
    raisedBedName: string;
    raisedBedPhysicalId: string | null;
    positionIndex: number | null;
    data: {
        markdown: string;
        imageUrl: string;
        imageUrls?: string[];
        model?: string | null;
        inputTokens?: number | null;
        outputTokens?: number | null;
        totalTokens?: number | null;
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
    const markdown = row.data?.markdown.trim();

    return (
        <Stack spacing={4}>
            <Stack spacing={1} className="pr-6">
                <Typography level="h4" semiBold>
                    AI analiza
                </Typography>
                <RaisedBedCell row={row} />
            </Stack>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
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

            <Stack spacing={2}>
                <Typography level="body2" semiBold>
                    Generirani sadržaj
                </Typography>
                {markdown ? (
                    <Markdown className="rounded-md border bg-muted/20 p-3">
                        {markdown}
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
                    <NoDataPlaceholder>Nema priloženih slika</NoDataPlaceholder>
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
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Gredica | Polje</Table.Head>
                                <Table.Head>Model</Table.Head>
                                <Table.Head className="text-right">
                                    Ulazni tokeni
                                </Table.Head>
                                <Table.Head className="text-right">
                                    Izlazni tokeni
                                </Table.Head>
                                <Table.Head className="text-right">
                                    Ukupno tokeni
                                </Table.Head>
                                <Table.Head className="text-right">
                                    Trošak
                                </Table.Head>
                                <Table.Head>Datum</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {rows.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={7}>
                                        <NoDataPlaceholder>
                                            Nema AI analiza
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {rows.map((row) => (
                                <Table.Row
                                    key={row.id}
                                    role="button"
                                    tabIndex={0}
                                    className="cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                                    onClick={() => setSelectedRow(row)}
                                    onKeyDown={(event) => {
                                        if (
                                            event.key === 'Enter' ||
                                            event.key === ' '
                                        ) {
                                            event.preventDefault();
                                            setSelectedRow(row);
                                        }
                                    }}
                                >
                                    <Table.Cell>
                                        <RaisedBedCell row={row} />
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Chip size="sm">
                                            {row.data?.model ?? '-'}
                                        </Chip>
                                    </Table.Cell>
                                    <Table.Cell className="text-right">
                                        {formatTokens(row.data?.inputTokens)}
                                    </Table.Cell>
                                    <Table.Cell className="text-right">
                                        {formatTokens(row.data?.outputTokens)}
                                    </Table.Cell>
                                    <Table.Cell className="text-right">
                                        {formatTokens(row.data?.totalTokens)}
                                    </Table.Cell>
                                    <Table.Cell className="text-right">
                                        {formatAiCostUsd(
                                            estimateAiAnalysisCostUsd(row.data),
                                        )}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <LocalDateTime>
                                            {row.createdAt}
                                        </LocalDateTime>
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
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
