import {
    getEntitiesRaw,
    getInventoryConfig,
    getInventoryItemsByConfig,
} from '@gredice/storage';
import { auth } from '../../../../../lib/auth/auth';
import {
    generateInventoryPrintoutPdf,
    type InventoryPrintoutPdfItem,
    inventoryPrintoutFilename,
} from '../inventoryPrintoutPdf';
import { getInventoryItemState } from '../inventoryStatus';

export const dynamic = 'force-dynamic';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ inventoryId: string }> },
) {
    await auth(['admin']);

    const { inventoryId } = await params;
    const id = Number.parseInt(inventoryId, 10);
    if (Number.isNaN(id)) {
        return new Response('Inventory not found.', { status: 404 });
    }

    const config = await getInventoryConfig(id);
    if (!config) {
        return new Response('Inventory not found.', { status: 404 });
    }

    const [items, entities] = await Promise.all([
        getInventoryItemsByConfig(id),
        getEntitiesRaw(config.entityTypeName),
    ]);
    const entityLabels = new Map(
        entities.map((entity) => [entity.id, entityDisplayName(entity)]),
    );
    const printoutItems = items
        .map((item) => {
            return {
                label: itemLabel(item, config.entityTypeName, entityLabels),
                details: itemDetails(item),
                quantity: item.quantity,
            };
        })
        .sort(comparePrintoutItems);
    const summary = items.reduce(
        (result, item) => {
            result.totalQuantity += item.quantity;
            const state = getInventoryItemState(item, config.lowCountThreshold);
            if (state === 'critical') {
                result.emptyItems += 1;
            } else if (state === 'warning') {
                result.lowItems += 1;
            } else {
                result.normalItems += 1;
            }
            return result;
        },
        {
            totalItems: items.length,
            totalQuantity: 0,
            emptyItems: 0,
            lowItems: 0,
            normalItems: 0,
        },
    );
    const printedAt = new Date();
    const pdf = generateInventoryPrintoutPdf({
        inventoryLabel: config.label,
        printedAt,
        summary,
        items: printoutItems,
    });

    return new Response(pdf, {
        headers: {
            'Cache-Control': 'no-store',
            'Content-Disposition': `attachment; filename="${inventoryPrintoutFilename(
                config.label,
                printedAt,
            )}"`,
            'Content-Length': String(pdf.byteLength),
            'Content-Type': 'application/pdf',
        },
    });
}

type InventoryEntity = Awaited<ReturnType<typeof getEntitiesRaw>>[number];
type InventoryItem = Awaited<
    ReturnType<typeof getInventoryItemsByConfig>
>[number];

function comparePrintoutItems(
    left: InventoryPrintoutPdfItem,
    right: InventoryPrintoutPdfItem,
) {
    const labelComparison = left.label.localeCompare(right.label, 'hr-HR', {
        numeric: true,
        sensitivity: 'base',
    });
    if (labelComparison !== 0) {
        return labelComparison;
    }

    return left.details
        .join(' ')
        .localeCompare(right.details.join(' '), 'hr-HR', {
            numeric: true,
            sensitivity: 'base',
        });
}

function itemLabel(
    item: InventoryItem,
    entityTypeName: string,
    entityLabels: Map<number, string>,
) {
    if (item.entityId) {
        return (
            entityLabels.get(item.entityId) ??
            `${entityTypeName} ${item.entityId}`
        );
    }

    return `Stavka #${item.id}`;
}

function itemDetails(item: InventoryItem) {
    return [
        ...(item.serialNumber ? [`Serijski br.: ${item.serialNumber}`] : []),
        ...(item.notes ? [`Biljeska: ${item.notes}`] : []),
    ];
}

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
