import { deleteAttributeValue, deletePlant, getAttributeDefinitionCategories, getAttributeDefinitions, getPlantInternal, SelectAttributeDefinition, SelectAttributeValue, upsertAttributeValue } from '@gredice/storage';
import { Typography } from '@signalco/ui-primitives/Typography';
import { revalidatePath } from 'next/cache';
import { AttributeCategoryDetails } from './AttributeCategoryDetails';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@signalco/ui-primitives/Tabs';
import { Delete } from '@signalco/ui-icons';
import { ServerActionIconButton } from '../ServerActionIconButton';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

async function handleValueSave(
    entityId: number,
    attributeDefinition: SelectAttributeDefinition,
    attributeValueId?: number,
    newValue?: string | null) {
    'use server';

    const newAttributeValueValue = (newValue?.length ?? 0) <= 0 ? null : newValue;
    await upsertAttributeValue({
        id: attributeValueId,
        attributeDefinitionId: attributeDefinition.id,
        entityType: 'plant',
        entityId: entityId,
        value: newAttributeValueValue,
    });
    revalidatePath(`/admin/plants/${entityId}`);
}

async function handleValueDelete(
    attributeValue: SelectAttributeValue) {
    'use server';

    await deleteAttributeValue(attributeValue.id);
    revalidatePath(`/admin/plants/${attributeValue.entityId}`);
}

async function handleEntityDelete(entityId: number) {
    'use server';

    deletePlant(entityId);
    revalidatePath('/admin/plants');
    redirect('/admin/plants');
}

export default async function PlantDetails({ params }: { params: { plantId: string } }) {
    const [attributeDefinitions, attributeCategories, plant] = await Promise.all([
        getAttributeDefinitions('plant'),
        getAttributeDefinitionCategories('plant'),
        getPlantInternal(parseInt(params.plantId)),
    ]);
    if (!plant) {
        return <Typography>Biljka ne postoji</Typography>;
    }

    return (
        <Tabs defaultValue={attributeCategories.at(0)?.name}>
            <>
                <div className='flex justify-between items-center'>
                    <Typography level='h5'>{plant.attributes.find(pa => pa.definition.category === 'information' && pa.definition.name === 'name')?.value ?? 'Nepoznato'}</Typography>
                    <TabsList>
                        {attributeCategories.map((category) => (
                            <TabsTrigger key={category.name} value={category.name}>
                                {category.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    <div className='self-end'>
                        <ServerActionIconButton
                            actionProps={[plant.id]}
                            onClick={handleEntityDelete}
                            variant='plain'>
                            <Delete />
                        </ServerActionIconButton>
                    </div>
                </div>
                {attributeCategories.map((category) => (
                    <TabsContent value={category.name} key={category.name}>
                        <AttributeCategoryDetails
                            entity={plant}
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