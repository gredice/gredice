'use client';

import type {
    getEntitiesRaw,
    SelectAttributeDefinition,
} from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Duplicate } from '@signalco/ui-icons';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import Image from 'next/image';
import Link from 'next/link';
import { KnownPages } from '../../../src/KnownPages';
import { NoDataPlaceholder } from '../../shared/placeholders/NoDataPlaceholder';
import { ServerActionIconButton } from '../../shared/ServerActionIconButton';
import { EntityAttributeProgress } from '../directories/EntityAttributeProgress';
import { useFilter } from '../providers';

type Entities = Awaited<ReturnType<typeof getEntitiesRaw>>;

type EntitiesTableProps = {
    entityTypeName: string;
    entities: Entities;
    attributeDefinitions: SelectAttributeDefinition[];
    onDuplicate: (entityId: number) => Promise<void>;
};

export function EntitiesTable({
    entityTypeName,
    entities,
    attributeDefinitions,
    onDuplicate,
}: EntitiesTableProps) {
    const { filter } = useFilter();
    const normalized = filter.toLowerCase();
    const filteredEntities = entities.filter((entity) =>
        entityDisplayName(entity).toLowerCase().includes(normalized),
    );
    const displayDefinitions = attributeDefinitions.filter((d) => d.display);

    return (
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.Head>Status</Table.Head>
                    <Table.Head>Naziv</Table.Head>
                    {displayDefinitions.map((d) => (
                        <Table.Head key={d.id}>{d.label}</Table.Head>
                    ))}
                    <Table.Head>Ispunjenost</Table.Head>
                    <Table.Head>Zadnja izmjena</Table.Head>
                    <Table.Head></Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {!filteredEntities.length && (
                    <Table.Row>
                        <Table.Cell colSpan={5 + displayDefinitions.length}>
                            <NoDataPlaceholder />
                        </Table.Cell>
                    </Table.Row>
                )}
                {filteredEntities.map((entity) => (
                    <Table.Row key={entity.id} className="group">
                        <Table.Cell>
                            {entity.state === 'draft' ? (
                                <div className="flex">
                                    <Chip color="neutral" className="w-fit">
                                        Draft
                                    </Chip>
                                </div>
                            ) : null}
                        </Table.Cell>
                        <Table.Cell>
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
                        </Table.Cell>
                        {displayDefinitions.map((d) => (
                            <Table.Cell key={d.id}>
                                <EntityAttributeValueCell
                                    entity={entity}
                                    definition={d}
                                />
                            </Table.Cell>
                        ))}
                        <Table.Cell>
                            <div className="w-24">
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
                ))}
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
                <Image
                    src={imageUrl}
                    alt={definition.label}
                    width={40}
                    height={40}
                    className="size-10 rounded-md object-cover"
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
