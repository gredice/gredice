'use client';

import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Duplicate } from '@signalco/ui-icons';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { KnownPages } from '../../../src/KnownPages';
import { NoDataPlaceholder } from '../../shared/placeholders/NoDataPlaceholder';
import { ServerActionIconButton } from '../../shared/ServerActionIconButton';
import { EntityAttributeProgress } from '../directories/EntityAttributeProgress';
import { useFilter } from '../providers';

type AttributeDefinition = {
    id: number;
    label: string;
    required: boolean;
    defaultValue: string | null;
};

type EntityAttribute = {
    attributeDefinitionId: number;
    attributeDefinition: { category: string; name: string };
    value: string | null;
};

type Entity = {
    id: number;
    state: string;
    updatedAt: string;
    entityType: { label: string };
    attributes: EntityAttribute[];
};

type EntitiesTableProps = {
    entityTypeName: string;
    entities: Entity[];
    attributeDefinitions: AttributeDefinition[];
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

    return (
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.Head>Naziv</Table.Head>
                    <Table.Head>Ispunjenost</Table.Head>
                    <Table.Head>Status</Table.Head>
                    <Table.Head>Zadnja izmjena</Table.Head>
                    <Table.Head></Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {!filteredEntities.length && (
                    <Table.Row>
                        <Table.Cell colSpan={4}>
                            <NoDataPlaceholder />
                        </Table.Cell>
                    </Table.Row>
                )}
                {filteredEntities.map((entity) => (
                    <Table.Row key={entity.id} className="group">
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
                        <Table.Cell>
                            <div className="w-24">
                                <EntityAttributeProgress
                                    entity={entity}
                                    definitions={attributeDefinitions}
                                />
                            </div>
                        </Table.Cell>
                        <Table.Cell>
                            <div className="flex">
                                <Chip
                                    color={
                                        entity.state === 'draft'
                                            ? 'neutral'
                                            : 'success'
                                    }
                                >
                                    {entity.state === 'draft'
                                        ? 'U izradi'
                                        : 'Objavljeno'}
                                </Chip>
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

function entityDisplayName(entity: Entity) {
    return (
        entityAttributeValue(entity, 'information', 'label') ??
        entityAttributeValue(entity, 'information', 'name') ??
        `${entity.entityType.label} ${entity.id}`
    );
}

function entityAttributeValue(
    entity: Entity,
    categoryName: string,
    attributeName: string,
) {
    return entity.attributes.find(
        (a) =>
            a.attributeDefinition.category === categoryName &&
            a.attributeDefinition.name === attributeName,
    )?.value;
}
