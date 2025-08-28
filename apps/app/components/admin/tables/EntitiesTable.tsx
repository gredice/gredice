import { getAttributeDefinitions, getEntitiesRaw } from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Duplicate } from '@signalco/ui-icons';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { cache } from 'react';
import { duplicateEntity } from '../../../app/(actions)/entityActions';
import { entityDisplayName } from '../../../src/entities/entityAttributes';
import { KnownPages } from '../../../src/KnownPages';
import { NoDataPlaceholder } from '../../shared/placeholders/NoDataPlaceholder';
import { ServerActionIconButton } from '../../shared/ServerActionIconButton';
import { EntityAttributeProgress } from '../directories/EntityAttributeProgress';

const definitionsCache = cache(getAttributeDefinitions);

export async function EntitiesTable({
    entityTypeName,
    search = '',
}: {
    entityTypeName: string;
    search?: string;
}) {
    const [entities, definitions] = await Promise.all([
        getEntitiesRaw(entityTypeName),
        definitionsCache(entityTypeName),
    ]);

    const requiredDefinitions = definitions.filter((d) => d.required);
    const numberOfRequiredAttributes = requiredDefinitions.length;

    const filteredEntities = entities.filter((entity) => {
        const notPopulatedRequiredAttributes = requiredDefinitions.filter(
            (d) =>
                !d.defaultValue &&
                !entity.attributes.some(
                    (a) =>
                        a.attributeDefinitionId === d.id &&
                        (a.value?.length ?? 0) > 0,
                ),
        );
        const progress =
            numberOfRequiredAttributes > 0
                ? ((numberOfRequiredAttributes -
                      notPopulatedRequiredAttributes.length) /
                      numberOfRequiredAttributes) *
                  100
                : 100;
        const statusLabel =
            entity.state === 'draft' ? 'U izradi' : 'Objavljeno';
        const searchString = `${entityDisplayName(entity)} ${progress.toFixed(
            0,
        )}% ${statusLabel} ${entity.updatedAt}`.toLowerCase();
        return searchString.includes(search.toLowerCase());
    });

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
                {filteredEntities.map((entity) => {
                    return (
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
                                        entityTypeName={entityTypeName}
                                        entity={entity}
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
                                    onClick={duplicateEntity.bind(
                                        null,
                                        entityTypeName,
                                        entity.id,
                                    )}
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
