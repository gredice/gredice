'use client';

import { Card, CardOverflow } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Markdown } from '@gredice/ui/Markdown';
import { Modal } from '@gredice/ui/Modal';
import { Stack } from '@gredice/ui/Stack';
import { Table } from '@gredice/ui/Table';
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
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Račun | korisnik</Table.Head>
                                <Table.Head>Model</Table.Head>
                                <Table.Head>Status</Table.Head>
                                <Table.Head className="text-right">
                                    Poruke
                                </Table.Head>
                                <Table.Head className="text-right">
                                    Alati
                                </Table.Head>
                                <Table.Head className="text-right">
                                    Tokeni
                                </Table.Head>
                                <Table.Head className="text-right">
                                    Trošak
                                </Table.Head>
                                <Table.Head>Zadnja poruka</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {rows.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={8}>
                                        <NoDataPlaceholder>
                                            Nema Suncokret razgovora
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
                                        <Stack spacing={0}>
                                            <Typography level="body2" semiBold>
                                                {row.accountId}
                                            </Typography>
                                            <Typography
                                                level="body3"
                                                className="text-muted-foreground"
                                            >
                                                {row.userLabel}
                                            </Typography>
                                        </Stack>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Chip size="sm">
                                            {row.model ?? '-'}
                                        </Chip>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Chip size="sm">{row.status}</Chip>
                                    </Table.Cell>
                                    <Table.Cell className="text-right">
                                        {formatTokens(row.messageCount)}
                                    </Table.Cell>
                                    <Table.Cell className="text-right">
                                        {formatTokens(row.toolCallCount)}
                                    </Table.Cell>
                                    <Table.Cell className="text-right">
                                        {formatTokens(row.totalTokens)}
                                    </Table.Cell>
                                    <Table.Cell className="text-right">
                                        {formatAiCostUsd(row.totalCostUsd)}
                                    </Table.Cell>
                                    <Table.Cell>
                                        {row.lastMessageAt ? (
                                            <LocalDateTime>
                                                {row.lastMessageAt}
                                            </LocalDateTime>
                                        ) : (
                                            '-'
                                        )}
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
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
