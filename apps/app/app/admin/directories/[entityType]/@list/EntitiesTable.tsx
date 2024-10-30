import { getEntitiesRaw } from '@gredice/storage';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { Add } from '@signalco/ui-icons';
import { createEntity } from '../../../../(actions)/entityActions';
import { ServerActionButton } from '../../../../../components/shared/ServerActionButton';
import { KnownPages } from '../../../../../src/KnownPages';

export async function EntitiesTable({ entityTypeName }: { entityTypeName: string }) {
    const entities = await getEntitiesRaw(entityTypeName);
    const createEntityBound = createEntity.bind(null, entityTypeName);

    return (
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.Head>Naziv</Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {entities.map(entity => (
                    <Table.Row key={entity.id}>
                        <Table.Cell>
                            <Link href={KnownPages.DirectoryEntity(entityTypeName, entity.id)}>
                                <Typography>{entity.attributes.find(a => a.attributeDefinition.name === 'name')?.value ?? `${entity.entityType.label} ${entity.id}`}</Typography>
                            </Link>
                        </Table.Cell>
                    </Table.Row>
                ))}
                <Table.Row>
                    <Table.Cell className='p-0'>
                        <ServerActionButton
                            variant="plain"
                            size='lg'
                            fullWidth
                            title="Dodaj zapis"
                            onClick={createEntityBound}
                            startDecorator={<Add className='size-5' />}>
                            Dodaj zapis
                        </ServerActionButton>
                    </Table.Cell>
                </Table.Row>
            </Table.Body>
        </Table>
    );
}