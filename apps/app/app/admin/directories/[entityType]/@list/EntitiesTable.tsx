import { getAttributeDefinitions, getEntitiesRaw } from '@gredice/storage';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { Add } from '@signalco/ui-icons';
import { createEntity } from '../../../../(actions)/entityActions';
import { ServerActionButton } from '../../../../../components/shared/ServerActionButton';
import { KnownPages } from '../../../../../src/KnownPages';
import { Tooltip, TooltipContent, TooltipTrigger } from '@signalco/ui-primitives/Tooltip';
import { cx } from '@signalco/ui-primitives/cx'
import { Chip } from '@signalco/ui-primitives/Chip';

export async function EntitiesTable({ entityTypeName }: { entityTypeName: string }) {
    const definitions = await getAttributeDefinitions(entityTypeName);
    const entities = await getEntitiesRaw(entityTypeName);
    const createEntityBound = createEntity.bind(null, entityTypeName);

    return (
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.Head>Naziv</Table.Head>
                    <Table.Head>Podaci</Table.Head>
                    <Table.Head>Status</Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {entities.map(entity => {
                    const numberOfRequiredAttributes = definitions.filter(d => d.required).length;
                    const notPopulatedRequiredAttributes = definitions.filter(d => d.required && !entity.attributes.some(a => a.attributeDefinitionId === d.id));
                    const progress = ((numberOfRequiredAttributes - notPopulatedRequiredAttributes.length) / numberOfRequiredAttributes) * 100;
                    return (
                        <Table.Row key={entity.id}>
                            <Table.Cell>
                                <Link href={KnownPages.DirectoryEntity(entityTypeName, entity.id)}>
                                    <Typography>{entity.attributes.find(a => a.attributeDefinition.name === 'name')?.value ?? `${entity.entityType.label} ${entity.id}`}</Typography>
                                </Link>
                            </Table.Cell>
                            <Table.Cell>
                                <Link href={KnownPages.DirectoryEntity(entityTypeName, entity.id)}>
                                    {/* Progress bar displaying status of populated required attribute values */}
                                    <Tooltip delayDuration={250}>
                                        <TooltipTrigger>
                                            <div className='py-2 px-1'>
                                                <div className='h-1 bg-gray-200 rounded-full overflow-hidden w-14'>
                                                    <div
                                                        className={cx('h-full', progress <= 99.99 ? 'bg-red-400' : 'bg-green-500')}
                                                        style={{ width: `${progress}%` }} />
                                                </div>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            {notPopulatedRequiredAttributes.length === 0
                                                ? 'Svi obavezni atributi su ispunjeni'
                                                : `Manjak obaveznih atributa: ${notPopulatedRequiredAttributes.map(a => a.label).join(', ')}`}
                                        </TooltipContent>
                                    </Tooltip>
                                </Link>
                            </Table.Cell>
                            <Table.Cell>
                                <Chip color={entity.state === 'draft' ? 'neutral' : 'success'} className='w-fit'>
                                    {entity.state === 'draft' ? 'U izradi' : 'Objavljeno'}
                                </Chip>
                            </Table.Cell>
                        </Table.Row>
                    );
                })}
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