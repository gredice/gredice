import { getAttributeDefinitionCategories, getAttributeDefinitions, getEntityRaw } from '@gredice/storage';
import { Typography } from '@signalco/ui-primitives/Typography';
import { AttributeCategoryDetails } from './AttributeCategoryDetails';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@signalco/ui-primitives/Tabs';
import { Delete } from '@signalco/ui-icons';
import { ServerActionIconButton } from '../../../../../components/shared/ServerActionIconButton';
import { handleEntityDelete } from '../../../../(actions)/entityActions';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function EntityDetailsPage({ params }: { params: { entityType: string, entityId: string } }) {
    const [attributeDefinitions, attributeCategories, entity] = await Promise.all([
        getAttributeDefinitions(params.entityType),
        getAttributeDefinitionCategories(params.entityType),
        getEntityRaw(parseInt(params.entityId)),
    ]);
    if (!entity) {
        notFound();
    }

    return (
        <div>
            <Tabs defaultValue={attributeCategories.at(0)?.name}> 
                <div className='flex justify-between items-center'>
                    <Typography level='h5'>{entity.attributes.find(pa => pa.attributeDefinition.category === 'information' && pa.attributeDefinition.name === 'name')?.value ?? 'Nepoznato'}</Typography>
                    <TabsList>
                        {attributeCategories.map((category) => (
                            <TabsTrigger key={category.name} value={category.name}>
                                {category.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    <div className='self-end'>
                        <ServerActionIconButton
                            actionProps={[{ entityTypeName: params.entityType, entityId: entity.id }]}
                            onClick={handleEntityDelete}
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