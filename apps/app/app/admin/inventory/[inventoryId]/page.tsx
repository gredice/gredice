import {
    computeInventoryItemsSummary,
    getEntitiesRaw,
    getInventoryConfig,
    getInventoryItemsByConfig,
} from '@gredice/storage';
import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { IconButton } from '@gredice/ui/IconButton';
import { Add, Edit, Printer } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
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
import { InventoryFilters } from './InventoryFilters';
import { InventoryItemsTable } from './InventoryItemsTable';
import { InventoryStatusProgress } from './InventoryStatusProgress';
import { normalizeInventoryStateFilter } from './inventoryStatus';

export const dynamic = 'force-dynamic';

export default async function InventoryConfigPage({
    params,
    searchParams,
}: {
    params: Promise<{ inventoryId: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    await auth(['admin']);

    const { inventoryId } = await params;
    const urlParams = await searchParams;
    const id = parseInt(inventoryId, 10);
    const stateFilter = normalizeInventoryStateFilter(
        typeof urlParams.state === 'string' ? urlParams.state : '',
    );

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
            <Stack spacing={4}>
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
                        <Row spacing={2}>
                            <Link href={KnownPages.InventoryPrintout(id)}>
                                <Row
                                    spacing={2}
                                    className="text-sm font-medium px-3 py-2 rounded-md border hover:bg-accent transition-colors"
                                >
                                    <Printer className="size-4" />
                                    <span>Preuzmi PDF</span>
                                </Row>
                            </Link>
                            <IconButton
                                aria-label="Dodaj stavku"
                                href={KnownPages.InventoryItemCreate(id)}
                                title="Dodaj stavku"
                                variant="solid"
                            >
                                <Add className="size-5" />
                            </IconButton>
                            <Link href={KnownPages.InventoryConfigEdit(id)}>
                                <Row
                                    spacing={2}
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
                    <Stack spacing={3}>
                        <InventoryFilters />
                        <Card>
                            <CardOverflow>
                                <InventoryItemsTable
                                    inventoryConfigId={id}
                                    entityTypeName={config.entityTypeName}
                                    items={tableItems}
                                    tracksSerialNumbers={tracksSerialNumbers}
                                    stateFilter={stateFilter}
                                />
                            </CardOverflow>
                        </Card>
                    </Stack>
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
