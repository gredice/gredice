import { deleteAttributeValue, getAttributeDefinitionCategories, getAttributeDefinitions, getPlantInternal, SelectAttributeDefinition, SelectAttributeValue, upsertAttributeValue } from '@gredice/storage';
import { Typography } from '@signalco/ui-primitives/Typography';
import { revalidatePath } from 'next/cache';
import { AttributeTabs } from './AttributeTabs';

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
        <AttributeTabs
            entity={plant}
            attributeCategories={attributeCategories}
            attributeDefinitions={attributeDefinitions}
            onValueSave={handleValueSave}
            onValueDelete={handleValueDelete} />
    )
}