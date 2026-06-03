import { buildHarvestTracePublicUrl } from '@gredice/client';
import {
    getHarvestTraceLinksAdmin,
    type HarvestTraceLinkStatus,
} from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { ExternalLink, Link as LinkIcon, Search } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
import { Stack } from '@gredice/ui/Stack';
import { Table } from '@gredice/ui/Table';
import { Typography } from '@gredice/ui/Typography';
import { AdminPageHeader } from '../../../components/admin/navigation';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';

export const dynamic = 'force-dynamic';

function getStringParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function getStatusParam(value: string | string[] | undefined) {
    const status = getStringParam(value);
    switch (status) {
        case 'active':
        case 'revoked':
            return status;
        default:
            return 'all';
    }
}

function getScanStateParam(value: string | string[] | undefined) {
    const scanState = getStringParam(value);
    switch (scanState) {
        case 'scanned':
        case 'not-scanned':
            return scanState;
        default:
            return 'all';
    }
}

function statusChip(status: HarvestTraceLinkStatus) {
    return (
        <Chip
            color={status === 'active' ? 'success' : 'warning'}
            variant="soft"
        >
            {status === 'active' ? 'Aktivan' : 'Opozvan'}
        </Chip>
    );
}

function scanSummary(scanCount: number, lastScannedAt: Date | null) {
    if (scanCount === 0) {
        return <Typography level="body2">Nema skeniranja</Typography>;
    }

    return (
        <Stack spacing={1}>
            <Typography level="body2" semiBold>
                {scanCount} skeniranja
            </Typography>
            {lastScannedAt ? (
                <Typography level="body2" className="text-muted-foreground">
                    Zadnje:{' '}
                    <LocalDateTime time={false}>{lastScannedAt}</LocalDateTime>
                </Typography>
            ) : null}
        </Stack>
    );
}

export default async function HarvestTracesPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    await auth(['admin']);
    const params = await searchParams;
    const query = getStringParam(params.q).trim();
    const status = getStatusParam(params.status);
    const scanState = getScanStateParam(params.scans);
    const traces = await getHarvestTraceLinksAdmin({
        query,
        status,
        scanState,
    });
    const activeCount = traces.filter(
        (trace) => trace.status === 'active',
    ).length;
    const scannedCount = traces.filter((trace) => trace.scanCount > 0).length;

    return (
        <Stack spacing={4}>
            <AdminPageHeader heading="QR tragovi" />
            <Typography className="text-muted-foreground">
                Audit javnih QR poveznica za etikete berbe.
            </Typography>

            <div className="grid gap-3 sm:grid-cols-3">
                <Card className="p-4">
                    <Typography level="body2" className="text-muted-foreground">
                        Prikazano
                    </Typography>
                    <Typography level="h2">{traces.length}</Typography>
                </Card>
                <Card className="p-4">
                    <Typography level="body2" className="text-muted-foreground">
                        Aktivno
                    </Typography>
                    <Typography level="h2">{activeCount}</Typography>
                </Card>
                <Card className="p-4">
                    <Typography level="body2" className="text-muted-foreground">
                        Skenirano
                    </Typography>
                    <Typography level="h2">{scannedCount}</Typography>
                </Card>
            </div>

            <Card className="p-4">
                <form
                    action={KnownPages.HarvestTraces}
                    className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_12rem_auto]"
                    method="get"
                >
                    <label className="space-y-1.5">
                        <Typography level="body2" semiBold>
                            Token, URL ili gredica
                        </Typography>
                        <input
                            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-hidden focus:border-ring focus:ring-2 focus:ring-ring/30"
                            defaultValue={query}
                            name="q"
                            placeholder="trag/... ili 12B"
                        />
                    </label>
                    <label className="space-y-1.5">
                        <Typography level="body2" semiBold>
                            Status
                        </Typography>
                        <select
                            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-hidden focus:border-ring focus:ring-2 focus:ring-ring/30"
                            defaultValue={status}
                            name="status"
                        >
                            <option value="all">Svi statusi</option>
                            <option value="active">Aktivni</option>
                            <option value="revoked">Opozvani</option>
                        </select>
                    </label>
                    <label className="space-y-1.5">
                        <Typography level="body2" semiBold>
                            Skeniranja
                        </Typography>
                        <select
                            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-hidden focus:border-ring focus:ring-2 focus:ring-ring/30"
                            defaultValue={scanState}
                            name="scans"
                        >
                            <option value="all">Svi tragovi</option>
                            <option value="scanned">Skenirani</option>
                            <option value="not-scanned">Bez skeniranja</option>
                        </select>
                    </label>
                    <div className="flex items-end gap-2">
                        <Button
                            type="submit"
                            variant="solid"
                            startDecorator={<Search className="size-4" />}
                        >
                            Filtriraj
                        </Button>
                        <Button
                            href={KnownPages.HarvestTraces}
                            variant="outlined"
                        >
                            Očisti
                        </Button>
                    </div>
                </form>
            </Card>

            <Card>
                <CardOverflow>
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Status</Table.Head>
                                <Table.Head>Javni trag</Table.Head>
                                <Table.Head>Biljka</Table.Head>
                                <Table.Head>Lokacija</Table.Head>
                                <Table.Head>Ispis</Table.Head>
                                <Table.Head>Skeniranja</Table.Head>
                                <Table.Head>Akcije</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {traces.length === 0 ? (
                                <Table.Row>
                                    <Table.Cell colSpan={7}>
                                        <NoDataPlaceholder>
                                            Nema QR tragova za odabrane filtere
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            ) : null}
                            {traces.map((trace) => {
                                const publicUrl = buildHarvestTracePublicUrl(
                                    trace.publicToken,
                                );

                                return (
                                    <Table.Row key={trace.id}>
                                        <Table.Cell>
                                            {statusChip(trace.status)}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Stack spacing={1}>
                                                <Row
                                                    spacing={2}
                                                    alignItems="center"
                                                >
                                                    <LinkIcon className="size-4 text-muted-foreground" />
                                                    <code className="max-w-[16rem] truncate rounded bg-muted px-1.5 py-0.5 text-xs">
                                                        {trace.publicToken}
                                                    </code>
                                                </Row>
                                                <a
                                                    className="inline-flex items-center gap-1 text-sm text-primary underline"
                                                    href={publicUrl}
                                                    rel="noreferrer"
                                                    target="_blank"
                                                >
                                                    {trace.publicPath}
                                                    <ExternalLink className="size-3.5" />
                                                </a>
                                            </Stack>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Stack spacing={1}>
                                                <Typography semiBold>
                                                    {trace.plantSortName}
                                                </Typography>
                                                <Typography
                                                    level="body2"
                                                    className="text-muted-foreground"
                                                >
                                                    {trace.harvestLabel}
                                                </Typography>
                                            </Stack>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Stack spacing={1}>
                                                <RaisedBedLabel
                                                    physicalId={
                                                        trace.raisedBedPhysicalId
                                                    }
                                                    name={trace.raisedBedName}
                                                    size="compact"
                                                />
                                                <Typography
                                                    level="body2"
                                                    className="text-muted-foreground"
                                                >
                                                    Polje {trace.fieldLabel}
                                                </Typography>
                                            </Stack>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Stack spacing={1}>
                                                {trace.printedAt ? (
                                                    <LocalDateTime time={false}>
                                                        {trace.printedAt}
                                                    </LocalDateTime>
                                                ) : (
                                                    <Typography level="body2">
                                                        Nije označeno
                                                    </Typography>
                                                )}
                                                <Typography
                                                    level="body2"
                                                    className="text-muted-foreground"
                                                >
                                                    Kreirano{' '}
                                                    <LocalDateTime time={false}>
                                                        {trace.createdAt}
                                                    </LocalDateTime>
                                                </Typography>
                                            </Stack>
                                        </Table.Cell>
                                        <Table.Cell>
                                            {scanSummary(
                                                trace.scanCount,
                                                trace.lastScannedAt,
                                            )}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Button
                                                href={KnownPages.HarvestTrace(
                                                    trace.id,
                                                )}
                                                variant="outlined"
                                                size="sm"
                                            >
                                                Detalji
                                            </Button>
                                        </Table.Cell>
                                    </Table.Row>
                                );
                            })}
                        </Table.Body>
                    </Table>
                </CardOverflow>
            </Card>
        </Stack>
    );
}
