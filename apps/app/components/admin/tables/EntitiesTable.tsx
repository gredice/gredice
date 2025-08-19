import { getEntitiesRaw } from '@gredice/storage';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { KnownPages } from '../../../src/KnownPages';
import { Chip } from '@signalco/ui-primitives/Chip';
import { EntityAttributeProgress } from '../directories/EntityAttributeProgress';
import { NoDataPlaceholder } from '../../shared/placeholders/NoDataPlaceholder';
import { entityDisplayName } from '../../../src/entities/entityAttributes';
import { ServerActionIconButton } from '../../shared/ServerActionIconButton';
import { Duplicate } from '@signalco/ui-icons';
import { duplicateEntity } from '../../../app/(actions)/entityActions';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';

export async function EntitiesTable({ entityTypeName }: { entityTypeName: string }) {
    const entities = await getEntitiesRaw(entityTypeName);

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
                {!entities.length && (
                    <Table.Row>
                        <Table.Cell colSpan={4}>
                            <NoDataPlaceholder />
                        </Table.Cell>
                    </Table.Row>
                )}
                {entities.map(entity => {
                    return (
                        <Table.Row key={entity.id} className='group'>
                            <Table.Cell>
                                <Link href={KnownPages.DirectoryEntity(entityTypeName, entity.id)}>
                                    <Typography>{entityDisplayName(entity)}</Typography>
                                </Link>
                            </Table.Cell>
                            <Table.Cell>
                                <div className='w-24'>
                                    <EntityAttributeProgress
                                        entityTypeName={entityTypeName}
                                        entity={entity} />
                                </div>
                            </Table.Cell>
                            <Table.Cell>
                                <div className='flex'>
                                    <Chip color={entity.state === 'draft' ? 'neutral' : 'success'}>
                                        {entity.state === 'draft' ? 'U izradi' : 'Objavljeno'}
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
                                    className='group-hover:opacity-100 opacity-0 transition-opacity'
                                    onClick={duplicateEntity.bind(null, entityTypeName, entity.id)}>
                                    <Duplicate className='size-5' />
                                </ServerActionIconButton>
                            </Table.Cell>
                        </Table.Row>
                    );
                })}
            </Table.Body>
        </Table>
    );
}
