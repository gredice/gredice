import {
    type AiAnalyticsOperation,
    type AiAnalyticsOperationType,
    getAiAnalysisEvents,
    getAiAnalysisTotals,
    getAiChatAccountLimitSummaries,
    getAiChatConversationsForAdmin,
    getAiChatUsageTotals,
    getRaisedBedMetadataByIds,
} from '@gredice/storage';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { Stack } from '@gredice/ui/Stack';
import { Table } from '@gredice/ui/Table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@gredice/ui/Tabs';
import { Typography } from '@gredice/ui/Typography';
import { auth } from '../../../lib/auth/auth';
import {
    formatAiCostUsd,
    sumAiAnalysisCostUsd,
} from '../../../src/ai/aiAnalyticsCost';
import { AiAnalyticsFilters } from './AiAnalyticsFilters';
import { type AiAnalyticsRow, AiAnalyticsTable } from './AiAnalyticsTable';
import { AiChatAnalyticsTable, type AiChatRow } from './AiChatAnalyticsTable';
import {
    aiAnalyticsOperationTypeLabel,
    isAiAnalyticsOperationType,
} from './aiAnalyticsPresentation';

export const dynamic = 'force-dynamic';

function formatTokens(value: number | undefined | null) {
    if (value == null) return '-';
    return value.toLocaleString('hr-HR');
}

function microUsdToUsd(value: number) {
    return value / 1_000_000;
}

function parseRaisedBedAggregateId(aggregateId: string) {
    const [raisedBedIdRaw, positionIndexRaw] = aggregateId.split('|');
    const raisedBedId = Number.parseInt(raisedBedIdRaw ?? '', 10);
    const positionIndex = Number.parseInt(positionIndexRaw ?? '', 10);

    return {
        raisedBedId: Number.isFinite(raisedBedId) ? raisedBedId : null,
        positionIndex: Number.isFinite(positionIndex) ? positionIndex : null,
    };
}

function parseOperationTypeFilter(
    value: string | string[] | undefined,
): AiAnalyticsOperationType | undefined {
    const normalized = typeof value === 'string' ? value : undefined;
    return isAiAnalyticsOperationType(normalized) ? normalized : undefined;
}

function getRaisedBedReference(event: AiAnalyticsOperation) {
    const raisedBedId = event.data?.raisedBedId;
    if (typeof raisedBedId === 'number') {
        return {
            raisedBedId,
            positionIndex:
                typeof event.data?.focusPositionIndex === 'number'
                    ? event.data.focusPositionIndex
                    : null,
        };
    }

    return parseRaisedBedAggregateId(event.aggregateId);
}

export default async function AiAnalyticsPage({
    searchParams,
}: {
    searchParams: Promise<{ type?: string | string[] }>;
}) {
    await auth(['admin']);
    const params = await searchParams;
    const selectedOperationType = parseOperationTypeFilter(params.type);
    const operationTypes = selectedOperationType
        ? [selectedOperationType]
        : undefined;

    const now = new Date();
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
        events,
        totals30d,
        totals24h,
        chatConversations,
        chatTotals30d,
        chatTotals24h,
        accountLimitSummaries,
    ] = await Promise.all([
        getAiAnalysisEvents({ operationTypes }),
        getAiAnalysisTotals({ from: last30d, operationTypes }),
        getAiAnalysisTotals({ from: last24h, operationTypes }),
        getAiChatConversationsForAdmin(100),
        getAiChatUsageTotals({ from: last30d }),
        getAiChatUsageTotals({ from: last24h }),
        getAiChatAccountLimitSummaries(100),
    ]);
    const raisedBedIds = Array.from(
        new Set(
            events
                .map((event) => getRaisedBedReference(event).raisedBedId)
                .filter(
                    (raisedBedId): raisedBedId is number => raisedBedId != null,
                ),
        ),
    );
    const raisedBeds = await getRaisedBedMetadataByIds(raisedBedIds);
    const raisedBedsById = new Map(
        raisedBeds.map((raisedBed) => [raisedBed.id, raisedBed]),
    );

    const totalInputTokens = events.reduce(
        (sum, e) => sum + (e.data?.inputTokens ?? 0),
        0,
    );
    const totalOutputTokens = events.reduce(
        (sum, e) => sum + (e.data?.outputTokens ?? 0),
        0,
    );
    const totalTokens = events.reduce(
        (sum, e) => sum + (e.data?.totalTokens ?? 0),
        0,
    );
    const totalCostUsd = sumAiAnalysisCostUsd(events);
    const chatRows: AiChatRow[] = chatConversations.map((conversation) => {
        const finalizedUsage = conversation.usageLedger.filter(
            (usage) => usage.status === 'finalized',
        );
        return {
            id: conversation.id,
            accountId: conversation.accountId,
            userLabel:
                conversation.user.displayName ??
                conversation.user.userName ??
                conversation.userId,
            model: conversation.model,
            status: conversation.status,
            createdAt: conversation.createdAt.toISOString(),
            lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
            messageCount: conversation.messages.length,
            toolCallCount: conversation.toolCalls.length,
            totalTokens: finalizedUsage.reduce(
                (sum, usage) => sum + usage.totalTokens,
                0,
            ),
            totalCostUsd: microUsdToUsd(
                finalizedUsage.reduce(
                    (sum, usage) => sum + usage.totalMicroUsd,
                    0,
                ),
            ),
            messages: conversation.messages.map((message) => ({
                id: message.id,
                role: message.role,
                parts: message.parts,
                metadata: message.metadata,
                createdAt: message.createdAt.toISOString(),
            })),
            toolCalls: conversation.toolCalls.map((toolCall) => ({
                id: toolCall.id,
                toolName: toolCall.toolName,
                state: toolCall.state,
                needsApproval: toolCall.needsApproval,
                input: toolCall.input,
                output: toolCall.output,
                error: toolCall.error,
                createdAt: toolCall.createdAt.toISOString(),
            })),
        };
    });
    const rows: AiAnalyticsRow[] = events.map((event) => {
        const { raisedBedId, positionIndex } = getRaisedBedReference(event);
        const raisedBed =
            raisedBedId == null ? undefined : raisedBedsById.get(raisedBedId);
        const raisedBedName =
            raisedBed?.name?.trim() ||
            (raisedBed?.physicalId
                ? `Gredica ${raisedBed.physicalId}`
                : raisedBedId != null
                  ? `Gredica #${raisedBedId}`
                  : 'Nepoznata gredica');

        return {
            id: event.id,
            createdAt: event.createdAt.toISOString(),
            type: event.aiOperationType,
            typeLabel: aiAnalyticsOperationTypeLabel(event.aiOperationType),
            raisedBedName,
            raisedBedPhysicalId: raisedBed?.physicalId ?? null,
            positionIndex,
            sourceEventType: event.sourceEventType ?? null,
            sourceAggregateId: event.sourceAggregateId ?? null,
            automationRunId: event.automationRunId ?? null,
            data: event.data
                ? {
                      markdown: event.data.markdown,
                      imageUrl: event.data.imageUrl,
                      imageUrls: event.data.imageUrls,
                      model: event.data.model,
                      inputTokens: event.data.inputTokens,
                      outputTokens: event.data.outputTokens,
                      totalTokens: event.data.totalTokens,
                      summary: event.data.summary,
                      source: event.data.source,
                      imageCount: event.data.imageCount,
                      proposalCount: event.data.proposalCount,
                      acceptedProposalCount: event.data.acceptedProposalCount,
                      requestCount: event.data.requestCount,
                  }
                : null,
        };
    });

    return (
        <Stack spacing={4}>
            <Tabs defaultValue="analysis">
                <TabsList className="grid w-full grid-cols-2 md:w-auto">
                    <TabsTrigger value="analysis">Analize</TabsTrigger>
                    <TabsTrigger value="chat">Chat</TabsTrigger>
                </TabsList>
                <TabsContent value="analysis" className="mt-4">
                    <Stack spacing={4}>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            <Card>
                                <CardOverflow>
                                    <Stack className="p-2">
                                        <Typography level="body3">
                                            Ukupno operacija
                                        </Typography>
                                        <Typography level="h4" semiBold>
                                            {events.length}
                                        </Typography>
                                    </Stack>
                                </CardOverflow>
                            </Card>
                            <Card>
                                <CardOverflow>
                                    <Stack className="p-2">
                                        <Typography level="body3">
                                            Zadnjih 24h
                                        </Typography>
                                        <Typography level="h4" semiBold>
                                            {totals24h.count}
                                        </Typography>
                                    </Stack>
                                </CardOverflow>
                            </Card>
                            <Card>
                                <CardOverflow>
                                    <Stack className="p-2">
                                        <Typography level="body3">
                                            Zadnjih 30 dana
                                        </Typography>
                                        <Typography level="h4" semiBold>
                                            {totals30d.count}
                                        </Typography>
                                    </Stack>
                                </CardOverflow>
                            </Card>
                            <Card>
                                <CardOverflow>
                                    <Stack className="p-2">
                                        <Typography level="body3">
                                            Ukupno tokena
                                        </Typography>
                                        <Typography level="h4" semiBold>
                                            {formatTokens(totalTokens)}
                                        </Typography>
                                    </Stack>
                                </CardOverflow>
                            </Card>
                            <Card>
                                <CardOverflow>
                                    <Stack className="p-2">
                                        <Typography level="body3">
                                            Ukupni trošak
                                        </Typography>
                                        <Typography level="h4" semiBold>
                                            {formatAiCostUsd(totalCostUsd)}
                                        </Typography>
                                    </Stack>
                                </CardOverflow>
                            </Card>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            <Card>
                                <CardOverflow>
                                    <Stack className="p-2">
                                        <Typography level="body3">
                                            Ulazni tokeni
                                        </Typography>
                                        <Typography level="h4" semiBold>
                                            {formatTokens(totalInputTokens)}
                                        </Typography>
                                    </Stack>
                                </CardOverflow>
                            </Card>
                            <Card>
                                <CardOverflow>
                                    <Stack className="p-2">
                                        <Typography level="body3">
                                            Izlazni tokeni
                                        </Typography>
                                        <Typography level="h4" semiBold>
                                            {formatTokens(totalOutputTokens)}
                                        </Typography>
                                    </Stack>
                                </CardOverflow>
                            </Card>
                            <Card>
                                <CardOverflow>
                                    <Stack className="p-2">
                                        <Typography level="body3">
                                            Prosj. tokeni/zahtjev
                                        </Typography>
                                        <Typography level="h4" semiBold>
                                            {events.length > 0
                                                ? formatTokens(
                                                      Math.round(
                                                          totalTokens /
                                                              events.length,
                                                      ),
                                                  )
                                                : '-'}
                                        </Typography>
                                    </Stack>
                                </CardOverflow>
                            </Card>
                        </div>
                        <Typography level="h3" semiBold>
                            Analize gredica
                        </Typography>
                        <AiAnalyticsFilters />
                        <AiAnalyticsTable rows={rows} />
                    </Stack>
                </TabsContent>
                <TabsContent value="chat" className="mt-4">
                    <Stack spacing={4}>
                        <Typography level="h3" semiBold>
                            Suncokret chat
                        </Typography>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            <Card>
                                <CardOverflow>
                                    <Stack className="p-2">
                                        <Typography level="body3">
                                            Razgovori
                                        </Typography>
                                        <Typography level="h4" semiBold>
                                            {chatConversations.length}
                                        </Typography>
                                    </Stack>
                                </CardOverflow>
                            </Card>
                            <Card>
                                <CardOverflow>
                                    <Stack className="p-2">
                                        <Typography level="body3">
                                            Chat 24h
                                        </Typography>
                                        <Typography level="h4" semiBold>
                                            {chatTotals24h.count}
                                        </Typography>
                                    </Stack>
                                </CardOverflow>
                            </Card>
                            <Card>
                                <CardOverflow>
                                    <Stack className="p-2">
                                        <Typography level="body3">
                                            Chat 30d
                                        </Typography>
                                        <Typography level="h4" semiBold>
                                            {chatTotals30d.count}
                                        </Typography>
                                    </Stack>
                                </CardOverflow>
                            </Card>
                            <Card>
                                <CardOverflow>
                                    <Stack className="p-2">
                                        <Typography level="body3">
                                            Chat tokeni
                                        </Typography>
                                        <Typography level="h4" semiBold>
                                            {formatTokens(
                                                chatTotals30d.totalTokens,
                                            )}
                                        </Typography>
                                    </Stack>
                                </CardOverflow>
                            </Card>
                            <Card>
                                <CardOverflow>
                                    <Stack className="p-2">
                                        <Typography level="body3">
                                            Chat trošak
                                        </Typography>
                                        <Typography level="h4" semiBold>
                                            {formatAiCostUsd(
                                                microUsdToUsd(
                                                    chatTotals30d.totalMicroUsd,
                                                ),
                                            )}
                                        </Typography>
                                    </Stack>
                                </CardOverflow>
                            </Card>
                        </div>
                        <AiChatAnalyticsTable rows={chatRows} />
                        <Typography level="h3" semiBold>
                            Limiti računa
                        </Typography>
                        <Card>
                            <CardOverflow>
                                <Table>
                                    <Table.Header>
                                        <Table.Row>
                                            <Table.Head>Račun</Table.Head>
                                            <Table.Head>Tip</Table.Head>
                                            <Table.Head className="text-right">
                                                Dnevni limit
                                            </Table.Head>
                                            <Table.Head className="text-right">
                                                Iskorišteno
                                            </Table.Head>
                                            <Table.Head className="text-right">
                                                Rezervirano
                                            </Table.Head>
                                            <Table.Head className="text-right">
                                                Preostalo
                                            </Table.Head>
                                            <Table.Head>Probni dani</Table.Head>
                                            <Table.Head>Status</Table.Head>
                                        </Table.Row>
                                    </Table.Header>
                                    <Table.Body>
                                        {accountLimitSummaries.map(
                                            ({ account, limitState }) => (
                                                <Table.Row key={account.id}>
                                                    <Table.Cell>
                                                        <Stack spacing={0}>
                                                            <Typography
                                                                level="body2"
                                                                semiBold
                                                            >
                                                                {account.id}
                                                            </Typography>
                                                            <Typography
                                                                level="body3"
                                                                className="text-muted-foreground"
                                                            >
                                                                {account.accountUsers
                                                                    .map(
                                                                        (
                                                                            accountUser,
                                                                        ) =>
                                                                            accountUser
                                                                                .user
                                                                                .displayName ??
                                                                            accountUser
                                                                                .user
                                                                                .userName,
                                                                    )
                                                                    .join(', ')}
                                                            </Typography>
                                                        </Stack>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <Chip size="sm">
                                                            {limitState.activeRaisedBed
                                                                ? 'Aktivna gredica'
                                                                : 'Probni račun'}
                                                        </Chip>
                                                    </Table.Cell>
                                                    <Table.Cell className="text-right">
                                                        {formatAiCostUsd(
                                                            microUsdToUsd(
                                                                limitState.dailyLimitMicroUsd,
                                                            ),
                                                        )}
                                                    </Table.Cell>
                                                    <Table.Cell className="text-right">
                                                        {formatAiCostUsd(
                                                            microUsdToUsd(
                                                                limitState.usedMicroUsd,
                                                            ),
                                                        )}
                                                    </Table.Cell>
                                                    <Table.Cell className="text-right">
                                                        {formatAiCostUsd(
                                                            microUsdToUsd(
                                                                limitState.reservedMicroUsd,
                                                            ),
                                                        )}
                                                    </Table.Cell>
                                                    <Table.Cell className="text-right">
                                                        {formatAiCostUsd(
                                                            microUsdToUsd(
                                                                limitState.remainingMicroUsd,
                                                            ),
                                                        )}
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        {`${limitState.trialChatDaysUsed.toString()}/${limitState.trialChatDaysLimit.toString()}`}
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <Chip size="sm">
                                                            {limitState.blockedReason ??
                                                                'ok'}
                                                        </Chip>
                                                    </Table.Cell>
                                                </Table.Row>
                                            ),
                                        )}
                                    </Table.Body>
                                </Table>
                            </CardOverflow>
                        </Card>
                    </Stack>
                </TabsContent>
            </Tabs>
        </Stack>
    );
}
