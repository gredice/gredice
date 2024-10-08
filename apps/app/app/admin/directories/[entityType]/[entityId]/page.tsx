import { deleteAttributeValue, deleteEntity, getAttributeDefinitionCategories, getAttributeDefinitions, getEntityRaw, SelectAttributeDefinition, SelectAttributeValue, upsertAttributeValue } from '@gredice/storage';
import { Typography } from '@signalco/ui-primitives/Typography';
import { revalidatePath } from 'next/cache';
import { AttributeCategoryDetails } from './AttributeCategoryDetails';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@signalco/ui-primitives/Tabs';
import { Delete } from '@signalco/ui-icons';
import { ServerActionIconButton } from '../ServerActionIconButton';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

async function handleValueSave(
    entityType: string,
    entityId: number,
    attributeDefinition: SelectAttributeDefinition,
    attributeValueId?: number,
    newValue?: string | null) {
    'use server';

    const newAttributeValueValue = (newValue?.length ?? 0) <= 0 ? null : newValue;
    await upsertAttributeValue({
        id: attributeValueId,
        attributeDefinitionId: attributeDefinition.id,
        entityTypeName: 'plant',
        entityId: entityId,
        value: newAttributeValueValue,
    });
    revalidatePath(`/admin/directories/${entityType}/${entityId}`);
}

async function handleValueDelete(
    attributeValue: SelectAttributeValue) {
    'use server';

    await deleteAttributeValue(attributeValue.id);
    revalidatePath(`/admin/plants/${attributeValue.entityId}`);
}

async function handleEntityDelete({ entityType, entityId }: { entityType: string, entityId: number }) {
    'use server';

    deleteEntity(entityId);
    revalidatePath(`/admin/directories/${entityType}`);
    redirect(`/admin/directories/${entityType}`);
}

export default async function EntityDetailsPage({ params }: { params: { entityType: string, entityId: string } }) {
    const [attributeDefinitions, attributeCategories, entity] = await Promise.all([
        getAttributeDefinitions(params.entityType),
        getAttributeDefinitionCategories(params.entityType),
        getEntityRaw(parseInt(params.entityId)),
    ]);
    if (!entity) {
        return <Typography>Zapis ne postoji</Typography>;
    }

    return (
        <Tabs defaultValue={attributeCategories.at(0)?.name}>
            <>
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
                            actionProps={{ entityType: params.entityType, entityId: entity.id }}
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
                            onValueSave={handleValueSave}
                            onValueDelete={handleValueDelete} />
                    </TabsContent>
                ))}
            </>
        </Tabs>
    )
}