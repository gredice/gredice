'use client';

import type {
    getEntitiesRaw,
    SelectAttributeDefinition,
} from '@gredice/storage';
import { ImageViewer } from '@gredice/ui/ImageViewer';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Duplicate } from '@signalco/ui-icons';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { updateEntity } from '../../../app/(actions)/entityActions';
import { KnownPages } from '../../../src/KnownPages';
import { NoDataPlaceholder } from '../../shared/placeholders/NoDataPlaceholder';
import { ServerActionIconButton } from '../../shared/ServerActionIconButton';
import { EntityAttributeProgress } from '../directories/EntityAttributeProgress';
import { useFilter } from '../providers';
import { EntityTableStateChip } from './EntityTableStateChip';

type Entities = Awaited<ReturnType<typeof getEntitiesRaw>>;

type EntitiesTableProps = {
    entityTypeName: string;
    entities: Entities;
    attributeDefinitions: SelectAttributeDefinition[];
    inventoryItems: Array<{
        entityId: number | null;
        trackingType: 'pieces' | 'serialNumber';
        quantity: number;
    }>;
    onDuplicate: (entityId: number) => Promise<void>;
};

export function EntitiesTable({
    entityTypeName,
    entities,
    attributeDefinitions,
    inventoryItems,
    onDuplicate,
}: EntitiesTableProps) {
    const { filter } = useFilter();
    const normalized = filter.toLowerCase();
    const filteredEntities = entities.filter((entity) =>
        entityDisplayName(entity).toLowerCase().includes(normalized),
    );
    const displayDefinitions = attributeDefinitions.filter((d) => d.display);
    const inventoryByEntityId = new Map(
        inventoryItems
            .filter(
                (item): item is typeof item & { entityId: number } =>
                    item.entityId !== null,
            )
            .map((item) => [item.entityId, item]),
    );
    const hasInventory = inventoryByEntityId.size > 0;

    return (
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.Head>Naziv</Table.Head>
                    {displayDefinitions.map((d) => (
                        <Table.Head key={d.id}>{d.label}</Table.Head>
                    ))}
                    {hasInventory && <Table.Head>Zalihe</Table.Head>}
                    <Table.Head>Ispunjeno</Table.Head>
                    <Table.Head>Izmjene</Table.Head>
                    <Table.Head></Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {!filteredEntities.length && (
                    <Table.Row>
                        <Table.Cell
                            colSpan={
                                4 +
                                displayDefinitions.length +
                                (hasInventory ? 1 : 0)
                            }
                        >
                            <NoDataPlaceholder />
                        </Table.Cell>
                    </Table.Row>
                )}
                {filteredEntities.map((entity) => {
                    const inventoryItem = inventoryByEntityId.get(entity.id);

                    return (
                        <Table.Row key={entity.id} className="group">
                            <Table.Cell>
                                <div className="flex items-center gap-2">
                                    <EntityTableStateChip
                                        initialState={entity.state}
                                        onPublish={() =>
                                            updateEntity({
                                                id: entity.id,
                                                state: 'published',
                                            })
                                        }
                                    />
                                    <Link
                                        href={KnownPages.DirectoryEntity(
                                            entityTypeName,
                                            entity.id,
                                        )}
                                    >
                                        <Typography>
                                            {entityDisplayName(entity)}
                                        </Typography>
                                    </Link>
                                </div>
                            </Table.Cell>
                            {displayDefinitions.map((d) => (
                                <Table.Cell key={d.id}>
                                    <EntityAttributeValueCell
                                        entity={entity}
                                        definition={d}
                                    />
                                </Table.Cell>
                            ))}
                            {hasInventory && (
                                <Table.Cell>
                                    <Typography secondary>
                                        {inventoryItem?.quantity ?? 0}
                                    </Typography>
                                </Table.Cell>
                            )}
                            <Table.Cell>
                                <div className="w-20">
                                    <EntityAttributeProgress
                                        entity={entity}
                                        definitions={attributeDefinitions}
                                    />
                                </div>
                            </Table.Cell>
                            <Table.Cell>
                                <Typography secondary>
                                    <LocalDateTime time={false}>
                                        {entity.updatedAt}
                                    </LocalDateTime>
                                </Typography>
                            </Table.Cell>
                            <Table.Cell>
                                <ServerActionIconButton
                                    variant="plain"
                                    title="Dupliciraj zapis"
                                    className="group-hover:opacity-100 opacity-0 transition-opacity"
                                    onClick={onDuplicate.bind(null, entity.id)}
                                >
                                    <Duplicate className="size-5" />
                                </ServerActionIconButton>
                            </Table.Cell>
                        </Table.Row>
                    );
                })}
            </Table.Body>
        </Table>
    );
}

function EntityAttributeValueCell({
    entity,
    definition,
}: {
    entity: Entities[number];
    definition: SelectAttributeDefinition;
}) {
    const value = entityAttributeValueByDefinitionId(entity, definition.id);
    if (!value) {
        return <Typography secondary>-</Typography>;
    }

    if (definition.dataType === 'boolean') {
        const booleanValue = booleanAttributeValue(value);
        if (booleanValue !== null) {
            return (
                <Chip
                    color={booleanValue ? 'primary' : 'neutral'}
                    className="w-fit"
                    size="sm"
                >
                    {booleanValue ? 'Da' : 'Ne'}
                </Chip>
            );
        }
    }

    if (definition.dataType === 'image') {
        const imageUrl = imageAttributeValue(value);
        if (imageUrl) {
            return (
                <ImageViewer
                    src={imageUrl}
                    alt={definition.label}
                    previewWidth={40}
                    previewHeight={40}
                />
            );
        }
    }

    return <Typography secondary>{value}</Typography>;
}

function entityDisplayName(entity: Entities[number]) {
    return (
        entityAttributeValue(entity, 'information', 'label') ??
        entityAttributeValue(entity, 'information', 'name') ??
        `${entity.entityType.label} ${entity.id}`
    );
}

function entityAttributeValue(
    entity: Entities[number],
    categoryName: string,
    attributeName: string,
) {
    return entity.attributes.find(
        (a) =>
            a.attributeDefinition.category === categoryName &&
            a.attributeDefinition.name === attributeName,
    )?.value;
}

function entityAttributeValueByDefinitionId(
    entity: Entities[number],
    definitionId: number,
) {
    return entity.attributes.find(
        (a) => a.attributeDefinitionId === definitionId,
    )?.value;
}

function imageAttributeValue(value: string) {
    try {
        const data = JSON.parse(value);
        if (data && typeof data.url === 'string') {
            return data.url;
        }
    } catch {
        // ignored intentionally
    }

    return null;
}

function booleanAttributeValue(value: string) {
    return value === 'true' ? true : value === 'false' ? false : null;
}
