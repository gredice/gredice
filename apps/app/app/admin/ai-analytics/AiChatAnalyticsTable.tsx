'use client';

import { Card, CardOverflow } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Markdown } from '@gredice/ui/Markdown';
import { Modal } from '@gredice/ui/Modal';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { formatAiCostUsd } from '../../../src/ai/aiAnalyticsCost';

export type AiChatRow = {
    id: string;
    accountId: string;
    userLabel: string;
    model: string | null;
    status: string;
    createdAt: string;
    lastMessageAt: string | null;
    messageCount: number;
    toolCallCount: number;
    totalTokens: number;
    totalCostUsd: number;
    messages: Array<{
        id: string;
        role: string;
        parts: unknown[];
        metadata: unknown;
        createdAt: string;
    }>;
    toolCalls: Array<{
        id: string;
        toolName: string;
        state: string;
        needsApproval: boolean;
        input: unknown;
        output: unknown;
        error: string | null;
        createdAt: string;
    }>;
};

function formatTokens(value: number | undefined | null) {
    if (value == null) return '-';
    return value.toLocaleString('hr-HR');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function textPart(part: unknown) {
    if (!isRecord(part) || part.type !== 'text') {
        return null;
    }

    return typeof part.text === 'string' ? part.text : null;
}

function toolPart(part: unknown) {
    if (!isRecord(part)) {
        return null;
    }

    const type = typeof part.type === 'string' ? part.type : '';
    return type.startsWith('tool-') ? part : null;
}

function messagePartKey(part: unknown) {
    if (!isRecord(part)) {
        return 'part:unknown';
    }

    const type = typeof part.type === 'string' ? part.type : 'part';
    const id = typeof part.id === 'string' ? part.id : null;
    const toolCallId =
        typeof part.toolCallId === 'string' ? part.toolCallId : null;
    const text = typeof part.text === 'string' ? part.text.slice(0, 80) : null;

    return `${type}:${id ?? toolCallId ?? text ?? debugJson(part).slice(0, 80)}`;
}

function debugJson(value: unknown) {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

function AiChatDetails({ row }: { row: AiChatRow }) {
    return (
        <Stack spacing={4}>
            <Stack spacing={1} className="pr-6">
                <Typography level="h4" semiBold>
                    Suncokret razgovor
                </Typography>
                <Typography level="body2" className="text-muted-foreground">
                    {row.accountId} · {row.userLabel}
                </Typography>
            </Stack>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                <Stack spacing={0}>
                    <Typography level="body3">Model</Typography>
                    <Typography level="body2">{row.model ?? '-'}</Typography>
                </Stack>
                <Stack spacing={0}>
                    <Typography level="body3">Poruke</Typography>
                    <Typography level="body2">
                        {formatTokens(row.messageCount)}
                    </Typography>
                </Stack>
                <Stack spacing={0}>
                    <Typography level="body3">Alati</Typography>
                    <Typography level="body2">
                        {formatTokens(row.toolCallCount)}
                    </Typography>
                </Stack>
                <Stack spacing={0}>
                    <Typography level="body3">Tokeni</Typography>
                    <Typography level="body2">
                        {formatTokens(row.totalTokens)}
                    </Typography>
                </Stack>
                <Stack spacing={0}>
                    <Typography level="body3">Trošak</Typography>
                    <Typography level="body2">
                        {formatAiCostUsd(row.totalCostUsd)}
                    </Typography>
                </Stack>
            </div>
            <Stack spacing={2}>
                <Typography level="body2" semiBold>
                    Transkript
                </Typography>
                {row.messages.length === 0 ? (
                    <NoDataPlaceholder>
                        Nema spremljenih poruka
                    </NoDataPlaceholder>
                ) : (
                    row.messages.map((message) => {
                        const partKeyCounts = new Map<string, number>();

                        return (
                            <Stack
                                key={message.id}
                                spacing={2}
                                className="rounded-md border bg-muted/20 p-3"
                            >
                                <Typography level="body3" semiBold>
                                    {message.role}
                                </Typography>
                                {message.parts.map((part) => {
                                    const baseKey = messagePartKey(part);
                                    const duplicateCount =
                                        partKeyCounts.get(baseKey) ?? 0;
                                    partKeyCounts.set(
                                        baseKey,
                                        duplicateCount + 1,
                                    );
                                    const key =
                                        duplicateCount === 0
                                            ? baseKey
                                            : `${baseKey}:${duplicateCount}`;
                                    const text = textPart(part);
                                    if (text) {
                                        return (
                                            <Markdown
                                                key={key}
                                                className="rounded-md bg-background p-2"
                                            >
                                                {text}
                                            </Markdown>
                                        );
                                    }

                                    const tool = toolPart(part);
                                    if (tool) {
                                        return (
                                            <pre
                                                key={key}
                                                className="max-h-52 overflow-auto rounded-md bg-background p-2 text-xs"
                                            >
                                                {debugJson(tool)}
                                            </pre>
                                        );
                                    }

                                    return (
                                        <pre
                                            key={key}
                                            className="max-h-40 overflow-auto rounded-md bg-background p-2 text-xs"
                                        >
                                            {debugJson(part)}
                                        </pre>
                                    );
                                })}
                                {message.metadata ? (
                                    <details>
                                        <summary className="cursor-pointer text-xs text-muted-foreground">
                                            Metadata
                                        </summary>
                                        <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-background p-2 text-xs">
                                            {debugJson(message.metadata)}
                                        </pre>
                                    </details>
                                ) : null}
                            </Stack>
                        );
                    })
                )}
            </Stack>
            <Stack spacing={2}>
                <Typography level="body2" semiBold>
                    Pozivi alata
                </Typography>
                {row.toolCalls.length === 0 ? (
                    <NoDataPlaceholder>Nema poziva alata</NoDataPlaceholder>
                ) : (
                    <div className="space-y-2">
                        {row.toolCalls.map((toolCall) => (
                            <details
                                key={toolCall.id}
                                className="rounded-md border bg-muted/20 p-3"
                            >
                                <summary className="cursor-pointer">
                                    {toolCall.toolName} · {toolCall.state}
                                    {toolCall.needsApproval
                                        ? ' · odobrenje'
                                        : ''}
                                </summary>
                                <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-background p-2 text-xs">
                                    {debugJson(toolCall)}
                                </pre>
                            </details>
                        ))}
                    </div>
                )}
            </Stack>
        </Stack>
    );
}

export function AiChatAnalyticsTable({ rows }: { rows: AiChatRow[] }) {
    const [selectedRow, setSelectedRow] = useState<AiChatRow | null>(null);

    return (
        <>
            <Card>
                <CardOverflow>
                    {rows.length === 0 ? (
                        <div className="p-4">
                            <NoDataPlaceholder>
                                Nema Suncokret razgovora
                            </NoDataPlaceholder>
                        </div>
                    ) : (
                        <ul className="divide-y">
                            {rows.map((row) => (
                                <li key={row.id}>
                                    <button
                                        type="button"
                                        aria-label={`Otvori detalje Suncokret razgovora za račun ${row.accountId}`}
                                        className="grid w-full gap-3 px-3 py-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-4"
                                        onClick={() => setSelectedRow(row)}
                                    >
                                        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                            <Stack
                                                spacing={1}
                                                className="min-w-0"
                                            >
                                                <Typography
                                                    level="body2"
                                                    semiBold
                                                    className="min-w-0 break-words [overflow-wrap:anywhere]"
                                                >
                                                    {row.accountId}
                                                </Typography>
                                                <Typography
                                                    level="body3"
                                                    className="min-w-0 break-words text-muted-foreground [overflow-wrap:anywhere]"
                                                >
                                                    {row.userLabel}
                                                </Typography>
                                            </Stack>

                                            <div className="flex min-w-0 flex-col gap-2 lg:items-end">
                                                <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
                                                    <Chip size="sm">
                                                        {row.model ?? '-'}
                                                    </Chip>
                                                    <Chip size="sm">
                                                        {row.status}
                                                    </Chip>
                                                </div>

                                                <div className="grid min-w-0 gap-x-4 gap-y-1 text-muted-foreground sm:grid-cols-2 lg:text-right">
                                                    <Typography level="body3">
                                                        Poruke:{' '}
                                                        <span className="font-medium text-foreground tabular-nums">
                                                            {formatTokens(
                                                                row.messageCount,
                                                            )}
                                                        </span>
                                                    </Typography>
                                                    <Typography level="body3">
                                                        Alati:{' '}
                                                        <span className="font-medium text-foreground tabular-nums">
                                                            {formatTokens(
                                                                row.toolCallCount,
                                                            )}
                                                        </span>
                                                    </Typography>
                                                    <Typography level="body3">
                                                        Tokeni:{' '}
                                                        <span className="font-medium text-foreground tabular-nums">
                                                            {formatTokens(
                                                                row.totalTokens,
                                                            )}
                                                        </span>
                                                    </Typography>
                                                    <Typography level="body3">
                                                        Trošak:{' '}
                                                        <span className="font-medium text-foreground tabular-nums">
                                                            {formatAiCostUsd(
                                                                row.totalCostUsd,
                                                            )}
                                                        </span>
                                                    </Typography>
                                                </div>

                                                <Typography
                                                    level="body3"
                                                    className="text-muted-foreground lg:text-right"
                                                >
                                                    Zadnja poruka:{' '}
                                                    {row.lastMessageAt ? (
                                                        <span className="whitespace-nowrap">
                                                            <LocalDateTime>
                                                                {
                                                                    row.lastMessageAt
                                                                }
                                                            </LocalDateTime>
                                                        </span>
                                                    ) : (
                                                        '-'
                                                    )}
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
                title="Detalji Suncokret razgovora"
                open={Boolean(selectedRow)}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedRow(null);
                    }
                }}
                className="max-w-4xl"
            >
                {selectedRow && <AiChatDetails row={selectedRow} />}
            </Modal>
        </>
    );
}
