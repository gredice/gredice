import {
    computeInventoryItemsSummary,
    getEntitiesRaw,
    getInventoryConfig,
    getInventoryItemsByConfig,
} from '@gredice/storage';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Add, Edit } from '@signalco/ui-icons';
import { Card, CardContent, CardOverflow } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { Field } from '../../../../components/shared/fields/Field';
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

    return (
        <Stack spacing={2}>
            <Breadcrumbs
                items={[
                    {
                        label: <AdminBreadcrumbLevelSelector />,
                    },
                    { label: config.label },
                ]}
            />

            <Row spacing={1} justifyContent="space-between">
                <Typography level="h1" className="text-2xl" semiBold>
                    {config.label}
                </Typography>
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
                </Row>
            </Row>

            <Card>
                <CardContent noHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                            <Field
                                name="Ukupno stavki"
                                value={summary.totalItems}
                            />
                            <Field
                                name="Ukupna količina"
                                value={summary.totalQuantity}
                            />
                            <Field
                                name="Praćeno po komadima"
                                value={summary.byTrackingType.pieces}
                            />
                            <Field
                                name="Praćeno serijski"
                                value={summary.byTrackingType.serialNumber}
                            />
                        </div>
                        <InventoryStatusProgress
                            items={items}
                            defaultLowCountThreshold={config.lowCountThreshold}
                        />
                    </div>
                </CardContent>
            </Card>

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
        </Stack>
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
