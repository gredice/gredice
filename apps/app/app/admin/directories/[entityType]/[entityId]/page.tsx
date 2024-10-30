import { getAttributeDefinitionCategories, getAttributeDefinitions, getEntityRaw } from '@gredice/storage';
import { Typography } from '@signalco/ui-primitives/Typography';
import { AttributeCategoryDetails } from './AttributeCategoryDetails';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@signalco/ui-primitives/Tabs';
import { Delete } from '@signalco/ui-icons';
import { ServerActionIconButton } from '../../../../../components/shared/ServerActionIconButton';
import { handleEntityDelete } from '../../../../(actions)/entityActions';
import { notFound } from 'next/navigation';

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

    const name = entity.attributes.find(pa => pa.attributeDefinition.category === 'information' && pa.attributeDefinition.name === 'name')?.value ?? 'Nepoznato';
    const entityDeleteBound = handleEntityDelete.bind(null, params.entityType, parseInt(params.entityId));

    return (
        <div>
            <Tabs defaultValue={attributeCategories.at(0)?.name}> 
                <div className='flex justify-between items-center'>
                    <Typography level='h5'>{name}</Typography>
                    <TabsList>
                        {attributeCategories.map((category) => (
                            <TabsTrigger key={category.name} value={category.name}>
                                {category.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    <div className='self-end'>
                        <ServerActionIconButton
                            onClick={entityDeleteBound}
                            variant='plain'>
                            <Delete />
                        </ServerActionIconButton>
                    </div>
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
            </Tabs>
        </div>
    );
}