import { getRaisedBed } from '@gredice/storage';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import {
    Card,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
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

export default async function RaisedBedPage({
    params,
}: {
    params: Promise<{ raisedBedId: number }>;
}) {
    const { raisedBedId } = await params;
    await auth(['admin']);
    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        notFound();
    }
    const raisedBedTitle =
        raisedBed.name || `Gredica ${raisedBed.physicalId ?? raisedBed.id}`;
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
                <Stack spacing={2} className="px-4 pb-4">
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
            <Stack spacing={4}>
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
                                { label: 'Vrtovi' },
                                {
                                    label: raisedBed.gardenId ?? 'Nepoznato',
                                    href: raisedBed.gardenId
                                        ? KnownPages.Garden(raisedBed.gardenId)
                                        : undefined,
                                },
                                { label: 'Gredice' },
                                { label: raisedBed?.id },
                            ]}
                        />
                    }
                    actions={
                        <Row className="items-center" spacing={1}>
                            <RaisedBedActionsMenu
                                targetRaisedBedId={raisedBed.id}
                            />
                            <EntityDetailsPropertiesToggle />
                        </Row>
                    }
                    heading="Gredica"
                />
                <EntityDetailsPropertiesLayout properties={propertiesPanel}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card className="h-fit">
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
                                <CardTitle>Događaji</CardTitle>
                            </CardHeader>
                            <CardOverflow>
                                <Suspense>
                                    <RaisedBedEventsTable
                                        raisedBedId={raisedBed.id}
                                    />
                                </Suspense>
                            </CardOverflow>
                        </Card>
                    </div>
                </EntityDetailsPropertiesLayout>
            </Stack>
        </EntityDetailsPropertiesProvider>
    );
}
