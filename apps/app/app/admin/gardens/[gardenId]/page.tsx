import { getGarden } from '@gredice/storage';
import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import Image from 'next/image';
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
import { publicGardensFlag } from '../../../flags';
import { RaisedBedsTableCard } from '../../accounts/[accountId]/RaisedBedsTableCard';
import { AdminGardenVisibilityToggle } from './AdminGardenVisibilityToggle';

export const dynamic = 'force-dynamic';

function GardenPreviewCard({
    gardenId,
    gardenName,
}: {
    gardenId: number;
    gardenName: string;
}) {
    return (
        <Card className="overflow-hidden">
            <CardOverflow>
                <Image
                    src={`https://vrt.gredice.com/vrtovi/${gardenId}/opengraph-image?fullscreen=true`}
                    alt={gardenName}
                    layout="responsive"
                    width={1200}
                    height={630}
                />
            </CardOverflow>
        </Card>
    );
}

export default async function GardenPage({
    params,
}: {
    params: Promise<{ gardenId: number }>;
}) {
    const { gardenId } = await params;
    await auth(['admin']);
    const [garden, publicGardensEnabled] = await Promise.all([
        getGarden(gardenId),
        publicGardensFlag(),
    ]);

    if (!garden) {
        notFound();
    }
    const publicGardenUrl = KnownPages.GredicePublicGarden(garden.id);
    const propertyItems: EntityDetailsPropertyListItem[] = [
        { id: 'id', label: 'ID vrta', value: garden.id, mono: true },
        { id: 'name', label: 'Naziv', value: garden.name },
        {
            id: 'public',
            label: 'Javan',
            value: garden.isPublic ? 'Da' : 'Ne',
        },
        {
            id: 'account',
            label: 'Račun',
            value: garden.accountId ? (
                <Link href={KnownPages.Account(garden.accountId)}>
                    {garden.accountId}
                </Link>
            ) : (
                '-'
            ),
            mono: true,
        },
        { id: 'deleted', label: 'Obrisan', value: garden.isDeleted },
        {
            id: 'created-at',
            label: 'Datum kreiranja',
            value: garden.createdAt,
        },
        {
            id: 'updated-at',
            label: 'Datum ažuriranja',
            value: garden.updatedAt,
        },
    ];
    const propertiesPanel = (
        <EntityDetailsPropertiesPanel>
            <EntityDetailsPanelCard title="Detalji">
                <EntityDetailsPropertyList items={propertyItems} />
            </EntityDetailsPanelCard>
            <EntityDetailsPanelCard
                title="Vidljivost"
                action={
                    garden.isPublic ? (
                        <Chip color="success" size="sm" variant="soft">
                            Public
                        </Chip>
                    ) : (
                        <Chip color="neutral" size="sm" variant="soft">
                            Private
                        </Chip>
                    )
                }
            >
                <AdminGardenVisibilityToggle
                    enabled={publicGardensEnabled}
                    gardenId={garden.id}
                    isPublic={garden.isPublic}
                    publicUrl={publicGardenUrl}
                />
            </EntityDetailsPanelCard>
        </EntityDetailsPropertiesPanel>
    );

    return (
        <EntityDetailsPropertiesProvider>
            <Stack spacing={8}>
                <AdminPageTitle title={garden.name} />
                <AdminPageHeader
                    breadcrumbs={
                        <Breadcrumbs
                            items={[
                                {
                                    label: <AdminBreadcrumbLevelSelector />,
                                    href: KnownPages.Gardens,
                                },
                                { label: garden?.name },
                            ]}
                        />
                    }
                    actions={
                        <Row className="items-center" spacing={2}>
                            <EntityDetailsPropertiesToggle />
                        </Row>
                    }
                    heading={garden.name}
                />
                <EntityDetailsPropertiesLayout properties={propertiesPanel}>
                    <Stack spacing={8}>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <GardenPreviewCard
                                gardenId={gardenId}
                                gardenName={garden.name}
                            />
                        </div>
                        <RaisedBedsTableCard gardenId={gardenId} />
                    </Stack>
                </EntityDetailsPropertiesLayout>
            </Stack>
        </EntityDetailsPropertiesProvider>
    );
}
