import {
    isRaisedBedAbandoned,
    RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE,
    RAISED_BED_ABANDONED_DUE_TO_INACTIVITY_MESSAGE,
} from '@gredice/js/raisedBeds';
import { getRaisedBed, getRaisedBedDiaryEntries } from '@gredice/storage';
import { Alert } from '@gredice/ui/Alert';
import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Card, CardHeader, CardOverflow, CardTitle } from '@gredice/ui/Card';
import { ImageGallery } from '@gredice/ui/ImageGallery';
import { Warning } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
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
import { NotificationsTableCard } from '../../../../components/notifications/NotificationsTableCard';
import { RaisedBedEventsTable } from '../../../../components/raised-beds/RaisedBedEventsTable';
import { RaisedBedFieldsTable } from '../../../../components/raised-beds/RaisedBedFieldsTable';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import { OperationsTableCard } from './OperationsTableCard';
import { RaisedBedActionsMenu } from './RaisedBedActionsMenu';
import { RaisedBedPhysicalIdInput } from './RaisedBedPhysicalIdInput';
import { RaisedBedStatusSelect } from './RaisedBedStatusSelect';

export const dynamic = 'force-dynamic';

const RECENT_RAISED_BED_IMAGE_LIMIT = 12;
const recentRaisedBedImageDateFormatter = new Intl.DateTimeFormat('hr-HR', {
    dateStyle: 'short',
});

function recentRaisedBedImages(
    entries: Awaited<ReturnType<typeof getRaisedBedDiaryEntries>>,
    raisedBedId: number,
) {
    const seen = new Set<string>();

    return entries
        .flatMap((entry) =>
            (entry.imageUrls ?? []).flatMap((url, index) => {
                const trimmedUrl = url.trim();

                if (!trimmedUrl || seen.has(trimmedUrl)) {
                    return [];
                }

                seen.add(trimmedUrl);

                return {
                    src: trimmedUrl,
                    alt: `${entry.name || 'Slika gredice'} ${raisedBedId}-${
                        index + 1
                    }`,
                    dateLabel:
                        entry.timestamp instanceof Date
                            ? recentRaisedBedImageDateFormatter.format(
                                  entry.timestamp,
                              )
                            : undefined,
                };
            }),
        )
        .slice(0, RECENT_RAISED_BED_IMAGE_LIMIT);
}

export default async function RaisedBedPage({
    params,
    searchParams,
}: {
    params: Promise<{ raisedBedId: number }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const { raisedBedId } = await params;
    const resolvedSearchParams = await searchParams;
    await auth(['admin']);
    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        notFound();
    }
    const recentImages = recentRaisedBedImages(
        await getRaisedBedDiaryEntries(raisedBed.id),
        raisedBed.id,
    );
    const raisedBedTitle =
        raisedBed.name || `Gredica ${raisedBed.physicalId ?? raisedBed.id}`;
    const isAbandoned = isRaisedBedAbandoned(raisedBed.status);
    const propertyItems: EntityDetailsPropertyListItem[] = [
        { id: 'id', label: 'ID', value: raisedBed.id, mono: true },
        { id: 'name', label: 'Naziv', value: raisedBed.name },
        {
            id: 'created-at',
            label: 'Datum kreiranja',
            value: raisedBed.createdAt,
        },
    ];
    const propertiesPanel = (
        <EntityDetailsPropertiesPanel>
            <EntityDetailsPanelCard title="Detalji">
                <EntityDetailsPropertyList items={propertyItems} />
            </EntityDetailsPanelCard>
            <EntityDetailsPanelCard title="Uređivanje">
                <Stack spacing={4} className="px-4 pb-4">
                    <RaisedBedPhysicalIdInput
                        raisedBedId={raisedBed.id}
                        physicalId={raisedBed.physicalId}
                    />
                    <RaisedBedStatusSelect
                        raisedBedId={raisedBed.id}
                        status={raisedBed.status}
                    />
                </Stack>
            </EntityDetailsPanelCard>
        </EntityDetailsPropertiesPanel>
    );

    return (
        <EntityDetailsPropertiesProvider>
            <Stack spacing={8}>
                <AdminPageTitle title={raisedBedTitle} />
                <AdminPageHeader
                    breadcrumbs={
                        <Breadcrumbs
                            items={[
                                {
                                    label: <AdminBreadcrumbLevelSelector />,
                                    href: KnownPages.RaisedBeds,
                                },
                                { label: 'Računi', href: KnownPages.Accounts },
                                {
                                    label: raisedBed.accountId ?? 'Nepoznato',
                                    href: raisedBed.accountId
                                        ? KnownPages.Account(
                                              raisedBed.accountId,
                                          )
                                        : undefined,
                                },
                                {
                                    label: 'Vrtovi',
                                    href: KnownPages.Gardens,
                                },
                                {
                                    label: raisedBed.gardenId ?? 'Nepoznato',
                                    href: raisedBed.gardenId
                                        ? KnownPages.Garden(raisedBed.gardenId)
                                        : undefined,
                                },
                                {
                                    label: 'Gredice',
                                    href: KnownPages.RaisedBeds,
                                },
                                { label: raisedBed?.id },
                            ]}
                        />
                    }
                    actions={
                        <Row className="items-center" spacing={2}>
                            <RaisedBedActionsMenu
                                accountId={raisedBed.accountId}
                                gardenId={raisedBed.gardenId}
                                raisedBedName={raisedBedTitle}
                                status={raisedBed.status}
                                targetRaisedBedId={raisedBed.id}
                            />
                            <EntityDetailsPropertiesToggle />
                        </Row>
                    }
                    heading="Gredica"
                />
                <EntityDetailsPropertiesLayout properties={propertiesPanel}>
                    {recentImages.length > 0 && (
                        <ImageGallery
                            images={recentImages}
                            previewWidth={240}
                            previewHeight={160}
                            previewVariant="carousel"
                        />
                    )}
                    {isAbandoned && (
                        <Alert
                            color="warning"
                            startDecorator={
                                <Warning className="size-4 shrink-0" />
                            }
                        >
                            <Stack spacing={1}>
                                <Typography level="body2" semiBold>
                                    {
                                        RAISED_BED_ABANDONED_DUE_TO_INACTIVITY_MESSAGE
                                    }
                                </Typography>
                                <Typography level="body3">
                                    {
                                        RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE
                                    }
                                </Typography>
                            </Stack>
                        </Alert>
                    )}
                    <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Polja</CardTitle>
                            </CardHeader>
                            <CardOverflow className="mt-0">
                                <Suspense>
                                    <RaisedBedFieldsTable
                                        raisedBedId={raisedBed.id}
                                    />
                                </Suspense>
                            </CardOverflow>
                        </Card>
                        {raisedBed.accountId && raisedBed.gardenId && (
                            <>
                                <OperationsTableCard
                                    accountId={raisedBed.accountId}
                                    gardenId={raisedBed.gardenId}
                                    isRaisedBedAbandoned={isAbandoned}
                                    raisedBedId={raisedBed.id}
                                />
                                <NotificationsTableCard
                                    accountId={raisedBed.accountId}
                                    gardenId={raisedBed.gardenId}
                                    raisedBedId={raisedBed.id}
                                    scroll
                                />
                            </>
                        )}
                        <Card>
                            <CardHeader>
                                <CardTitle id="raised-bed-events">
                                    Događaji
                                </CardTitle>
                            </CardHeader>
                            <Suspense>
                                <RaisedBedEventsTable
                                    raisedBedId={raisedBed.id}
                                    searchParams={resolvedSearchParams}
                                />
                            </Suspense>
                        </Card>
                    </div>
                </EntityDetailsPropertiesLayout>
            </Stack>
        </EntityDetailsPropertiesProvider>
    );
}
