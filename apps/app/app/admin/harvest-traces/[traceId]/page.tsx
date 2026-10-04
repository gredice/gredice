import { buildHarvestTracePublicUrl } from '@gredice/client';
import {
    getHarvestTraceLinkAdminDetail,
    type HarvestTraceLinkAdminDetail,
    type HarvestTraceLinkStatus,
    type PublicHarvestTraceTimelineItem,
} from '@gredice/storage';
import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { ExternalLink, Leaf, Link as LinkIcon } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
    EntityDetailsPanelCard,
    EntityDetailsPropertiesLayout,
    EntityDetailsPropertiesPanel,
    EntityDetailsPropertiesProvider,
    EntityDetailsPropertiesToggle,
    EntityDetailsPropertyList,
    type EntityDetailsPropertyListItem,
} from '../../../../components/admin/details';
import { AdminPageHeader } from '../../../../components/admin/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { AdminPageTitle } from '../../../../components/admin/navigation/AdminPageTitle';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import { updateHarvestTraceStatusAction } from '../actions';

export const dynamic = 'force-dynamic';

const dateFormatter = new Intl.DateTimeFormat('hr-HR', {
    dateStyle: 'medium',
});

function parseTraceId(value: string) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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

function formatDateString(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return dateFormatter.format(date);
}

function HarvestTraceStatusForm({
    trace,
}: {
    trace: HarvestTraceLinkAdminDetail;
}) {
    const nextStatus = trace.status === 'active' ? 'revoked' : 'active';

    return (
        <form action={updateHarvestTraceStatusAction}>
            <input name="traceId" type="hidden" value={trace.id} />
            <input name="status" type="hidden" value={nextStatus} />
            <Button
                color={trace.status === 'active' ? 'danger' : 'success'}
                type="submit"
                variant={trace.status === 'active' ? 'outlined' : 'solid'}
            >
                {trace.status === 'active'
                    ? 'Opozovi trag'
                    : 'Ponovno aktiviraj'}
            </Button>
        </form>
    );
}

function TimelineItem({ item }: { item: PublicHarvestTraceTimelineItem }) {
    return (
        <li className="grid gap-1 rounded-lg border bg-background p-4">
            <Row spacing={2} alignItems="center">
                <Leaf className="size-4 text-primary" />
                <Typography level="body2" semiBold>
                    {formatDateString(item.occurredAt)}
                </Typography>
            </Row>
            <Typography semiBold>{item.title}</Typography>
            {item.description ? (
                <Typography level="body2" className="text-muted-foreground">
                    {item.description}
                </Typography>
            ) : null}
            {item.location ? (
                <TraceTimelineLocation location={item.location} />
            ) : null}
        </li>
    );
}

function TraceTimelineLocation({
    location,
}: {
    location: NonNullable<PublicHarvestTraceTimelineItem['location']>;
}) {
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <RaisedBedLabel
                physicalId={location.raisedBedPhysicalId}
                name={location.raisedBedName}
                size="compact"
            />
            {location.fieldLabel ? (
                <Typography level="body2" className="text-muted-foreground">
                    Polje {location.fieldLabel}
                </Typography>
            ) : null}
        </div>
    );
}

function TracePreview({ trace }: { trace: HarvestTraceLinkAdminDetail }) {
    if (!trace.timeline) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Javni prikaz</CardTitle>
                </CardHeader>
                <CardContent>
                    <Typography className="text-muted-foreground">
                        Trag je opozvan ili se javni prikaz ne može složiti iz
                        trenutnih podataka.
                    </Typography>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <Stack spacing={1}>
                    <CardTitle>Javni prikaz</CardTitle>
                    <Typography className="text-muted-foreground">
                        Sažetak koji kupac vidi nakon skeniranja QR etikete.
                    </Typography>
                </Stack>
            </CardHeader>
            <CardContent>
                <Stack spacing={5}>
                    <div className="rounded-lg border bg-muted/20 p-4">
                        <Stack spacing={2}>
                            <Typography level="h2">
                                {trace.timeline.title}
                            </Typography>
                            <Typography className="text-muted-foreground">
                                {trace.timeline.subtitle}
                            </Typography>
                            <TraceTimelineLocation
                                location={{
                                    raisedBedPhysicalId:
                                        trace.timeline.context
                                            .raisedBedPhysicalId,
                                    raisedBedName:
                                        trace.timeline.context.raisedBedName,
                                    fieldLabel:
                                        trace.timeline.context.fieldLabel,
                                }}
                            />
                        </Stack>
                    </div>
                    {trace.timeline.timeline.length > 0 ? (
                        <ol className="space-y-3">
                            {trace.timeline.timeline.map((item) => (
                                <TimelineItem key={item.id} item={item} />
                            ))}
                        </ol>
                    ) : (
                        <Typography className="text-muted-foreground">
                            Nema javnih timeline zapisa.
                        </Typography>
                    )}
                </Stack>
            </CardContent>
        </Card>
    );
}

function buildPropertyItems(
    trace: HarvestTraceLinkAdminDetail,
    publicUrl: string,
): EntityDetailsPropertyListItem[] {
    return [
        { id: 'id', label: 'ID', value: trace.id, mono: true },
        { id: 'status', label: 'Status', value: statusChip(trace.status) },
        {
            id: 'token',
            label: 'Javni token',
            value: trace.publicToken,
            mono: true,
        },
        {
            id: 'public-url',
            label: 'Javni URL',
            value: (
                <a
                    className="inline-flex max-w-full items-center gap-1 truncate text-primary underline"
                    href={publicUrl}
                    rel="noreferrer"
                    target="_blank"
                >
                    <span className="truncate">{trace.publicPath}</span>
                    <ExternalLink className="size-3.5 shrink-0" />
                </a>
            ),
        },
        {
            id: 'account-id',
            label: 'Račun',
            value: trace.accountId,
            mono: true,
        },
        { id: 'garden-id', label: 'Vrt', value: trace.gardenId },
        { id: 'raised-bed-id', label: 'Gredica ID', value: trace.raisedBedId },
        {
            id: 'raised-bed-field-id',
            label: 'Polje ID',
            value: trace.raisedBedFieldId,
        },
        {
            id: 'plant-place-event-id',
            label: 'Plant event',
            value: trace.plantPlaceEventId,
        },
        {
            id: 'harvest-operation-id',
            label: 'Radnja berbe',
            value: trace.harvestOperationId,
        },
        { id: 'scan-count', label: 'Skeniranja', value: trace.scanCount },
        { id: 'created-at', label: 'Kreirano', value: trace.createdAt },
        { id: 'printed-at', label: 'Ispisano', value: trace.printedAt },
        {
            id: 'first-scan',
            label: 'Prvo skeniranje',
            value: trace.firstScannedAt,
        },
        {
            id: 'last-scan',
            label: 'Zadnje skeniranje',
            value: trace.lastScannedAt,
        },
        { id: 'revoked-at', label: 'Opozvano', value: trace.revokedAt },
    ];
}

export default async function HarvestTraceDetailsPage({
    params,
}: {
    params: Promise<{ traceId: string }>;
}) {
    await auth(['admin']);
    const { traceId } = await params;
    const traceIdNumber = parseTraceId(traceId);
    if (!traceIdNumber) {
        notFound();
    }

    const trace = await getHarvestTraceLinkAdminDetail(traceIdNumber);
    if (!trace) {
        notFound();
    }

    const publicUrl = buildHarvestTracePublicUrl(trace.publicToken);
    const propertiesPanel = (
        <EntityDetailsPropertiesPanel>
            <EntityDetailsPanelCard title="Detalji">
                <EntityDetailsPropertyList
                    items={buildPropertyItems(trace, publicUrl)}
                />
            </EntityDetailsPanelCard>
            <EntityDetailsPanelCard title="Status">
                <Stack spacing={3} className="px-4 pb-4">
                    <Typography level="body2" className="text-muted-foreground">
                        Opozvani tragovi više ne prikazuju javnu stranicu i ne
                        bilježe nova skeniranja.
                    </Typography>
                    <HarvestTraceStatusForm trace={trace} />
                </Stack>
            </EntityDetailsPanelCard>
        </EntityDetailsPropertiesPanel>
    );

    return (
        <EntityDetailsPropertiesProvider>
            <Stack spacing={6}>
                <AdminPageTitle title={`QR trag ${trace.id}`} />
                <AdminPageHeader
                    breadcrumbs={
                        <Breadcrumbs
                            items={[
                                {
                                    label: <AdminBreadcrumbLevelSelector />,
                                    href: KnownPages.HarvestTraces,
                                },
                                {
                                    label: 'QR tragovi',
                                    href: KnownPages.HarvestTraces,
                                },
                                { label: trace.id },
                            ]}
                        />
                    }
                    actions={
                        <Row spacing={2} alignItems="center">
                            <Button
                                href={publicUrl}
                                rel="noreferrer"
                                target="_blank"
                                variant="outlined"
                                startDecorator={<LinkIcon className="size-4" />}
                            >
                                Otvori javni trag
                            </Button>
                            <EntityDetailsPropertiesToggle />
                        </Row>
                    }
                    heading={`QR trag ${trace.id}`}
                />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                    <Typography>{trace.plantSortName}</Typography>
                    <span aria-hidden="true">·</span>
                    <RaisedBedLabel
                        physicalId={trace.raisedBedPhysicalId}
                        name={trace.raisedBedName}
                        size="compact"
                    />
                    <Typography level="body2">
                        Polje {trace.fieldLabel}
                    </Typography>
                </div>

                <div className="flex flex-wrap gap-2">
                    {statusChip(trace.status)}
                    <Chip variant="soft" color="neutral">
                        {trace.scanCount} skeniranja
                    </Chip>
                    {trace.printedAt ? (
                        <Chip variant="soft" color="info">
                            Ispisano{' '}
                            <LocalDateTime time={false}>
                                {trace.printedAt}
                            </LocalDateTime>
                        </Chip>
                    ) : null}
                </div>

                <EntityDetailsPropertiesLayout properties={propertiesPanel}>
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                        <TracePreview trace={trace} />
                        <Card>
                            <CardHeader>
                                <CardTitle>Izvori</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Stack spacing={3}>
                                    {trace.harvestOperationId ? (
                                        <Link
                                            className="text-primary underline"
                                            href={KnownPages.Operation(
                                                trace.harvestOperationId,
                                            )}
                                        >
                                            Radnja berbe{' '}
                                            {trace.harvestOperationId}
                                        </Link>
                                    ) : null}
                                    <Link
                                        className="inline-flex text-primary underline"
                                        href={KnownPages.RaisedBed(
                                            trace.raisedBedId,
                                        )}
                                    >
                                        <RaisedBedLabel
                                            physicalId={
                                                trace.raisedBedPhysicalId
                                            }
                                            name={trace.raisedBedName}
                                            size="compact"
                                        />
                                    </Link>
                                    <Link
                                        className="text-primary underline"
                                        href={KnownPages.Garden(trace.gardenId)}
                                    >
                                        Vrt {trace.gardenId}
                                    </Link>
                                    <Link
                                        className="text-primary underline"
                                        href={KnownPages.Account(
                                            trace.accountId,
                                        )}
                                    >
                                        Račun {trace.accountId}
                                    </Link>
                                </Stack>
                            </CardContent>
                        </Card>
                    </div>
                </EntityDetailsPropertiesLayout>
            </Stack>
        </EntityDetailsPropertiesProvider>
    );
}
