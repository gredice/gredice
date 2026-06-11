import {
    getEntitiesRaw,
    getInventoryConfig,
    getInventoryItemsByConfig,
} from '@gredice/storage';
import { auth } from '../../../../../lib/auth/auth';
import { getInventorySelectOptions } from '../../../../../lib/inventoryFieldTypes';
import {
    generateInventoryPrintoutPdf,
    type InventoryPrintoutPdfItem,
    inventoryPrintoutFilename,
} from '../inventoryPrintoutPdf';
import {
    getInventoryItemState,
    type InventoryStateFilter,
} from '../inventoryStatus';

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
            const quantityStatus = inventoryStateLabel(
                getInventoryItemState(item, config.lowCountThreshold),
            );
            const configuredStatus = configuredInventoryStatus(item, config);

            return {
                label: itemLabel(item, config.entityTypeName, entityLabels),
                details: itemDetails(item, config),
                quantity: item.quantity,
                currentStatus: configuredStatus
                    ? `${configuredStatus} / ${quantityStatus}`
                    : quantityStatus,
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

type InventoryConfig = NonNullable<
    Awaited<ReturnType<typeof getInventoryConfig>>
>;
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

    return left.currentStatus.localeCompare(right.currentStatus, 'hr-HR', {
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

function configuredInventoryStatus(
    item: InventoryItem,
    config: InventoryConfig,
) {
    const statusAttributeName = config.statusAttributeName;
    if (!statusAttributeName) {
        return null;
    }

    const value = item.additionalFields?.[statusAttributeName];
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const fieldDefinition = config.fieldDefinitions.find(
        (field) => field.name === statusAttributeName,
    );

    return formatAdditionalFieldValue(value, fieldDefinition?.dataType);
}

function formatAdditionalFieldValue(value: unknown, dataType?: string) {
    if (typeof value === 'string') {
        if (dataType) {
            const option = getInventorySelectOptions(dataType).find(
                (selectOption) => selectOption.value === value,
            );
            return option?.label ?? value;
        }

        return value;
    }

    if (typeof value === 'number') {
        return String(value);
    }

    if (typeof value === 'boolean') {
        return value ? 'Da' : 'Ne';
    }

    const jsonValue = JSON.stringify(value);
    return jsonValue ?? null;
}

function itemDetails(item: InventoryItem, config: InventoryConfig) {
    const details = [
        `ID #${item.id}`,
        `Pracenje: ${trackingTypeLabel(item.trackingType)}`,
    ];
    if (item.serialNumber) {
        details.push(`Serijski br.: ${item.serialNumber}`);
    }

    const lowCountThreshold =
        item.lowCountThreshold ?? config.lowCountThreshold;
    if (lowCountThreshold !== null) {
        details.push(`Minimum: ${lowCountThreshold}`);
    }

    details.push(`Dodano: ${formatItemDate(item.createdAt)}`);

    if (item.notes) {
        details.push(`Biljeska: ${item.notes}`);
    }

    return details;
}

function trackingTypeLabel(trackingType: string) {
    return trackingType === 'serialNumber' ? 'serijski broj' : 'komadi';
}

function formatItemDate(date: Date) {
    return new Intl.DateTimeFormat('hr-HR', {
        timeZone: 'Europe/Zagreb',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

function inventoryStateLabel(state: InventoryStateFilter) {
    if (state === 'critical') {
        return 'Prazno';
    }
    if (state === 'warning') {
        return 'Nisko';
    }

    return 'Uredno';
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
