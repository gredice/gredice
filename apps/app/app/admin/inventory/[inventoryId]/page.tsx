import {
    computeInventoryItemsSummary,
    getEntitiesRaw,
    getInventoryConfig,
    getInventoryItemsByConfig,
} from '@gredice/storage';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Add, Edit } from '@signalco/ui-icons';
import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
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
import { InventoryItemsTable } from './InventoryItemsTable';
import { InventoryStatusProgress } from './InventoryStatusProgress';

export const dynamic = 'force-dynamic';

export default async function InventoryConfigPage({
    params,
}: {
    params: Promise<{ inventoryId: string }>;
}) {
    await auth(['admin']);

    const { inventoryId } = await params;
    const id = parseInt(inventoryId, 10);

    const config = await getInventoryConfig(id);

    if (!config) {
        notFound();
    }

    const [items, entities] = await Promise.all([
        getInventoryItemsByConfig(id),
        getEntitiesRaw(config.entityTypeName),
    ]);

    const summary = computeInventoryItemsSummary(items);
    const entityLabels = new Map(
        entities.map((entity) => [entity.id, entityDisplayName(entity)]),
    );
    const tracksSerialNumbers =
        config.defaultTrackingType === 'serialNumber' ||
        items.some((item) => item.trackingType === 'serialNumber');
    const tableItems = items.map((item) => ({
        id: item.id,
        entityId: item.entityId,
        entityLabel: item.entityId
            ? (entityLabels.get(item.entityId) ?? null)
            : null,
        serialNumber: item.serialNumber,
        quantity: item.quantity,
        lowCountThreshold:
            item.lowCountThreshold ?? config.lowCountThreshold ?? null,
        notes: item.notes,
        createdAt: item.createdAt.toISOString(),
    }));
    const summaryItems: EntityDetailsPropertyListItem[] = [
        {
            id: 'total-items',
            label: 'Ukupno stavki',
            value: summary.totalItems,
        },
        {
            id: 'total-quantity',
            label: 'Ukupna količina',
            value: summary.totalQuantity,
        },
        {
            id: 'pieces',
            label: 'Praćeno po komadima',
            value: summary.byTrackingType.pieces,
        },
        {
            id: 'serial-number',
            label: 'Praćeno serijski',
            value: summary.byTrackingType.serialNumber,
        },
    ];
    const propertiesPanel = (
        <EntityDetailsPropertiesPanel>
            <EntityDetailsPanelCard title="Sažetak">
                <EntityDetailsPropertyList items={summaryItems} />
            </EntityDetailsPanelCard>
            <EntityDetailsPanelCard title="Stanje">
                <div className="px-4 pb-4">
                    <InventoryStatusProgress
                        items={items}
                        defaultLowCountThreshold={config.lowCountThreshold}
                    />
                </div>
            </EntityDetailsPanelCard>
        </EntityDetailsPropertiesPanel>
    );

    return (
        <EntityDetailsPropertiesProvider>
            <Stack spacing={2}>
                <AdminPageTitle title={config.label} />
                <AdminPageHeader
                    breadcrumbs={
                        <Breadcrumbs
                            items={[
                                {
                                    label: <AdminBreadcrumbLevelSelector />,
                                },
                                { label: config.label },
                            ]}
                        />
                    }
                    actions={
                        <Row spacing={1}>
                            <Link href={KnownPages.InventoryItemCreate(id)}>
                                <Row
                                    spacing={1}
                                    className="text-sm font-medium px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                                >
                                    <Add className="size-4" />
                                    <span>Dodaj stavku</span>
                                </Row>
                            </Link>
                            <Link href={KnownPages.InventoryConfigEdit(id)}>
                                <Row
                                    spacing={1}
                                    className="text-sm font-medium px-3 py-2 rounded-md border hover:bg-accent transition-colors"
                                >
                                    <Edit className="size-4" />
                                    <span>Uredi</span>
                                </Row>
                            </Link>
                            <EntityDetailsPropertiesToggle />
                        </Row>
                    }
                    heading={config.label}
                />

                <EntityDetailsPropertiesLayout properties={propertiesPanel}>
                    <Card>
                        <CardOverflow>
                            <InventoryItemsTable
                                inventoryConfigId={id}
                                entityTypeName={config.entityTypeName}
                                items={tableItems}
                                tracksSerialNumbers={tracksSerialNumbers}
                            />
                        </CardOverflow>
                    </Card>
                </EntityDetailsPropertiesLayout>
            </Stack>
        </EntityDetailsPropertiesProvider>
    );
}

type InventoryEntity = Awaited<ReturnType<typeof getEntitiesRaw>>[number];

function entityDisplayName(entity: InventoryEntity) {
    return (
        entityAttributeValue(entity, 'information', 'label') ??
        entityAttributeValue(entity, 'information', 'name') ??
        `${entity.entityType.label} ${entity.id}`
    );
}

function entityAttributeValue(
    entity: InventoryEntity,
    categoryName: string,
    attributeName: string,
) {
    return entity.attributes.find(
        (attribute) =>
            attribute.attributeDefinition.category === categoryName &&
            attribute.attributeDefinition.name === attributeName,
    )?.value;
}
