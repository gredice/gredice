import {
    getAiAnalysisEvents,
    getAiAnalysisTotals,
    getRaisedBedMetadataByIds,
} from '@gredice/storage';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { auth } from '../../../lib/auth/auth';
import {
    formatAiCostUsd,
    sumAiAnalysisCostUsd,
} from '../../../src/ai/aiAnalyticsCost';
import { type AiAnalyticsRow, AiAnalyticsTable } from './AiAnalyticsTable';

export const dynamic = 'force-dynamic';

function formatTokens(value: number | undefined | null) {
    if (value == null) return '-';
    return value.toLocaleString('hr-HR');
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

export default async function AiAnalyticsPage() {
    await auth(['admin']);

    const now = new Date();
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [events, totals30d, totals24h] = await Promise.all([
        getAiAnalysisEvents(),
        getAiAnalysisTotals({ from: last30d }),
        getAiAnalysisTotals({ from: last24h }),
    ]);
    const raisedBedIds = events
        .map(
            (event) => parseRaisedBedAggregateId(event.aggregateId).raisedBedId,
        )
        .filter((raisedBedId): raisedBedId is number => raisedBedId != null);
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
    const rows: AiAnalyticsRow[] = events.map((event) => {
        const { raisedBedId, positionIndex } = parseRaisedBedAggregateId(
            event.aggregateId,
        );
        const raisedBed =
            raisedBedId == null ? undefined : raisedBedsById.get(raisedBedId);
        const raisedBedName =
            raisedBed?.name?.trim() ||
            (raisedBed?.physicalId
                ? `Gredica ${raisedBed.physicalId}`
                : 'Nepoznata gredica');

        return {
            id: event.id,
            createdAt: event.createdAt.toISOString(),
            raisedBedName,
            raisedBedPhysicalId: raisedBed?.physicalId ?? null,
            positionIndex,
            data: event.data
                ? {
                      markdown: event.data.markdown,
                      imageUrl: event.data.imageUrl,
                      imageUrls: event.data.imageUrls,
                      model: event.data.model,
                      inputTokens: event.data.inputTokens,
                      outputTokens: event.data.outputTokens,
                      totalTokens: event.data.totalTokens,
                  }
                : null,
        };
    });

    return (
        <Stack spacing={4}>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <Card>
                    <CardOverflow>
                        <Stack className="p-2">
                            <Typography level="body3">
                                Ukupno zahtjeva
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
                            <Typography level="body3">Zadnjih 24h</Typography>
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
                            <Typography level="body3">Ukupno tokena</Typography>
                            <Typography level="h4" semiBold>
                                {formatTokens(totalTokens)}
                            </Typography>
                        </Stack>
                    </CardOverflow>
                </Card>
                <Card>
                    <CardOverflow>
                        <Stack className="p-2">
                            <Typography level="body3">Ukupni trošak</Typography>
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
                            <Typography level="body3">Ulazni tokeni</Typography>
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
                                              totalTokens / events.length,
                                          ),
                                      )
                                    : '-'}
                            </Typography>
                        </Stack>
                    </CardOverflow>
                </Card>
            </div>
            <AiAnalyticsTable rows={rows} />
        </Stack>
    );
}
