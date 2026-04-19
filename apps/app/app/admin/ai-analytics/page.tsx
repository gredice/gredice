import { getAiAnalysisEvents, getAiAnalysisTotals } from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Table } from '@signalco/ui-primitives/Table';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../lib/auth/auth';

export const dynamic = 'force-dynamic';

function formatTokens(value: number | undefined | null) {
    if (value == null) return '-';
    return value.toLocaleString('hr-HR');
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

    return (
        <Stack spacing={2}>
            <Row spacing={1}>
                <Chip color="primary">{events.length}</Chip>
            </Row>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
            <Card>
                <CardOverflow>
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>ID</Table.Head>
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
                                <Table.Head>Datum</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {events.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={7}>
                                        <NoDataPlaceholder>
                                            Nema AI analiza
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {events.map((event) => (
                                <Table.Row key={event.id}>
                                    <Table.Cell>{event.id}</Table.Cell>
                                    <Table.Cell>{event.aggregateId}</Table.Cell>
                                    <Table.Cell>
                                        <Chip size="sm">
                                            {event.data?.model ?? '-'}
                                        </Chip>
                                    </Table.Cell>
                                    <Table.Cell className="text-right">
                                        {formatTokens(event.data?.inputTokens)}
                                    </Table.Cell>
                                    <Table.Cell className="text-right">
                                        {formatTokens(event.data?.outputTokens)}
                                    </Table.Cell>
                                    <Table.Cell className="text-right">
                                        {formatTokens(event.data?.totalTokens)}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <LocalDateTime>
                                            {event.createdAt}
                                        </LocalDateTime>
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                </CardOverflow>
            </Card>
        </Stack>
    );
}
