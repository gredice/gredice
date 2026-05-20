import { getFarm } from '@gredice/storage';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { ExternalLink } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
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
import { FarmSlackChannelForm } from './FarmSlackChannelForm';
import { FarmSnowAccumulationForm } from './FarmSnowAccumulationForm';
import { FarmUsersCard } from './FarmUsersCard';

export const dynamic = 'force-dynamic';

export default async function FarmPage({
    params,
}: {
    params: Promise<{ farmId: number }>;
}) {
    const { farmId } = await params;
    await auth(['admin']);

    const farm = await getFarm(farmId);

    if (!farm) {
        notFound();
    }
    const propertyItems: EntityDetailsPropertyListItem[] = [
        { id: 'id', label: 'ID farme', value: farm.id, mono: true },
        { id: 'name', label: 'Naziv', value: farm.name },
        { id: 'latitude', label: 'Latitude', value: farm.latitude },
        { id: 'longitude', label: 'Longitude', value: farm.longitude },
        {
            id: 'slack-channel',
            label: 'Slack kanal',
            value: farm.slackChannelId ?? '-',
        },
        { id: 'snow', label: 'Snijeg', value: `${farm.snowAccumulation} cm` },
        {
            id: 'created-at',
            label: 'Datum kreiranja',
            value: farm.createdAt,
        },
        {
            id: 'updated-at',
            label: 'Datum ažuriranja',
            value: farm.updatedAt,
        },
        { id: 'deleted', label: 'Obrisana', value: farm.isDeleted },
    ];
    const propertiesPanel = (
        <EntityDetailsPropertiesPanel>
            <EntityDetailsPanelCard title="Detalji">
                <EntityDetailsPropertyList items={propertyItems} />
            </EntityDetailsPanelCard>
        </EntityDetailsPropertiesPanel>
    );

    return (
        <EntityDetailsPropertiesProvider>
            <Stack spacing={4}>
                <AdminPageTitle title={farm.name} />
                <AdminPageHeader
                    breadcrumbs={
                        <Breadcrumbs
                            items={[
                                {
                                    label: <AdminBreadcrumbLevelSelector />,
                                    href: KnownPages.Farms,
                                },
                                { label: farm.name },
                            ]}
                        />
                    }
                    actions={
                        <Row className="items-center" spacing={1}>
                            <Button
                                href={`https://vrt.gredice.com/farme/${farm.id}`}
                                target="_blank"
                                rel="noreferrer"
                                startDecorator={
                                    <ExternalLink className="size-4 shrink-0" />
                                }
                            >
                                Stranica farme
                            </Button>
                            <EntityDetailsPropertiesToggle />
                        </Row>
                    }
                    heading={farm.name}
                />
                <EntityDetailsPropertiesLayout properties={propertiesPanel}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Slack kanal</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <FarmSlackChannelForm
                                    farmId={farmId}
                                    slackChannelId={farm.slackChannelId}
                                />
                                <p className="text-sm text-muted-foreground">
                                    Koristimo ovaj kanal za administrativne
                                    obavijesti o promjenama radnji na farmi.
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Snijeg</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <FarmSnowAccumulationForm
                                    farmId={farmId}
                                    snowAccumulation={farm.snowAccumulation}
                                />
                                <p className="text-sm text-muted-foreground">
                                    Trenutna količina snijega na farmi.
                                    Automatski se ažurira svakih sat vremena.
                                </p>
                            </CardContent>
                        </Card>
                        <FarmUsersCard farmId={farmId} />
                    </div>
                </EntityDetailsPropertiesLayout>
            </Stack>
        </EntityDetailsPropertiesProvider>
    );
}
