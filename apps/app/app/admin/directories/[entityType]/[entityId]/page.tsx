import { getAttributeDefinitionCategories, getAttributeDefinitions, getEntityRaw } from '@gredice/storage';
import { AttributeCategoryDetails } from './AttributeCategoryDetails';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@signalco/ui-primitives/Tabs';
import { Delete } from '@signalco/ui-icons';
import { ServerActionIconButton } from '../../../../../components/shared/ServerActionIconButton';
import { handleEntityDelete } from '../../../../(actions)/entityActions';
import { notFound } from 'next/navigation';
import { EntityStateSelect } from './EntityStateSelect';
import { Row } from '@signalco/ui-primitives/Row';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { KnownPages } from '../../../../../src/KnownPages';
import { entityDisplayName } from '../../../../../src/entities/entityAttributes';
import { Stack } from '@signalco/ui-primitives/Stack';

export const dynamic = 'force-dynamic';

export default async function EntityDetailsPage(props: { params: Promise<{ entityType: string, entityId: string }> }) {
    const params = await props.params;
    const [attributeDefinitions, attributeCategories, entity] = await Promise.all([
        getAttributeDefinitions(params.entityType),
        getAttributeDefinitionCategories(params.entityType),
        getEntityRaw(parseInt(params.entityId)),
    ]);
    if (!entity) {
        notFound();
    }

    const entityDeleteBound = handleEntityDelete.bind(null, params.entityType, parseInt(params.entityId));

    return (
        <Tabs defaultValue={attributeCategories.at(0)?.name}>
            <Stack spacing={2}>
                <div className='flex flex-row justify-between items-center'>
                    <Breadcrumbs items={[
                        { label: entity.entityType.label, href: KnownPages.DirectoryEntityType(params.entityType) },
                        { label: entityDisplayName(entity) },
                    ]} />
                    <TabsList>
                        {attributeCategories.map((category) => (
                            <TabsTrigger key={category.name} value={category.name}>
                                {category.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    <Row className='self-end' spacing={1}>
                        <EntityStateSelect entity={entity} />
                        <ServerActionIconButton
                            title='Obriši'
                            onClick={entityDeleteBound}
                            variant='plain'>
                            <Delete />
                        </ServerActionIconButton>
                    </Row>
                </div>
                {attributeCategories.map((category) => (
                    <TabsContent value={category.name} key={category.name}>
                        <AttributeCategoryDetails
                            entity={entity}
                            category={category}
                            attributeDefinitions={attributeDefinitions}
                        />
                    </TabsContent>
                ))}
            </Stack>
        </Tabs>
    );
}