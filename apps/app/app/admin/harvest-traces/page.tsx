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
                    {traces.length === 0 ? (
                        <div className="p-4">
                            <NoDataPlaceholder>
                                Nema QR tragova za odabrane filtere
                            </NoDataPlaceholder>
                        </div>
                    ) : (
                        <ul className="divide-y">
                            {traces.map((trace) => {
                                const publicUrl = buildHarvestTracePublicUrl(
                                    trace.publicToken,
                                );

                                return (
                                    <li
                                        key={trace.id}
                                        className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                                    >
                                        <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                            <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(14rem,1.15fr)_minmax(12rem,0.85fr)_minmax(10rem,0.75fr)]">
                                                <Stack
                                                    spacing={1}
                                                    className="min-w-0"
                                                >
                                                    <Typography
                                                        level="body3"
                                                        className="text-muted-foreground"
                                                    >
                                                        Javni trag
                                                    </Typography>
                                                    <Row
                                                        spacing={2}
                                                        alignItems="center"
                                                        className="min-w-0"
                                                    >
                                                        <LinkIcon className="size-4 shrink-0 text-muted-foreground" />
                                                        <code className="block min-w-0 max-w-full truncate rounded bg-muted px-1.5 py-0.5 text-xs">
                                                            {trace.publicToken}
                                                        </code>
                                                    </Row>
                                                    <a
                                                        className="inline-flex min-w-0 max-w-full items-center gap-1 text-sm text-primary underline"
                                                        href={publicUrl}
                                                        rel="noreferrer"
                                                        target="_blank"
                                                    >
                                                        <span className="min-w-0 truncate">
                                                            {trace.publicPath}
                                                        </span>
                                                        <ExternalLink className="size-3.5 shrink-0" />
                                                    </a>
                                                </Stack>
                                                <Stack
                                                    spacing={1}
                                                    className="min-w-0"
                                                >
                                                    <Typography
                                                        level="body3"
                                                        className="text-muted-foreground"
                                                    >
                                                        Biljka
                                                    </Typography>
                                                    <Typography
                                                        component="h3"
                                                        semiBold
                                                        className="min-w-0 truncate"
                                                    >
                                                        {trace.plantSortName}
                                                    </Typography>
                                                    <Typography
                                                        level="body2"
                                                        className="text-muted-foreground"
                                                    >
                                                        {trace.harvestLabel}
                                                    </Typography>
                                                </Stack>
                                                <Stack
                                                    spacing={1}
                                                    className="min-w-0"
                                                >
                                                    <Typography
                                                        level="body3"
                                                        className="text-muted-foreground"
                                                    >
                                                        Lokacija
                                                    </Typography>
                                                    <RaisedBedLabel
                                                        physicalId={
                                                            trace.raisedBedPhysicalId
                                                        }
                                                        name={
                                                            trace.raisedBedName
                                                        }
                                                        size="compact"
                                                    />
                                                    <Typography
                                                        level="body2"
                                                        className="text-muted-foreground"
                                                    >
                                                        Polje {trace.fieldLabel}
                                                    </Typography>
                                                </Stack>
                                            </div>
                                            <div className="flex min-w-0 flex-col gap-3 xl:max-w-[34rem] xl:items-end xl:text-right">
                                                <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end">
                                                    {statusChip(trace.status)}
                                                    <Button
                                                        href={KnownPages.HarvestTrace(
                                                            trace.id,
                                                        )}
                                                        variant="outlined"
                                                        size="sm"
                                                    >
                                                        Detalji
                                                    </Button>
                                                </div>
                                                <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:justify-items-end">
                                                    <Stack
                                                        spacing={1}
                                                        className="min-w-0"
                                                    >
                                                        <Typography
                                                            level="body3"
                                                            className="text-muted-foreground"
                                                        >
                                                            Ispis
                                                        </Typography>
                                                        {trace.printedAt ? (
                                                            <Typography level="body2">
                                                                <LocalDateTime
                                                                    time={false}
                                                                >
                                                                    {
                                                                        trace.printedAt
                                                                    }
                                                                </LocalDateTime>
                                                            </Typography>
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
                                                            <LocalDateTime
                                                                time={false}
                                                            >
                                                                {
                                                                    trace.createdAt
                                                                }
                                                            </LocalDateTime>
                                                        </Typography>
                                                    </Stack>
                                                    <Stack
                                                        spacing={1}
                                                        className="min-w-0"
                                                    >
                                                        <Typography
                                                            level="body3"
                                                            className="text-muted-foreground"
                                                        >
                                                            Skeniranja
                                                        </Typography>
                                                        {scanSummary(
                                                            trace.scanCount,
                                                            trace.lastScannedAt,
                                                        )}
                                                    </Stack>
                                                </div>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </CardOverflow>
            </Card>
        </Stack>
    );
}
