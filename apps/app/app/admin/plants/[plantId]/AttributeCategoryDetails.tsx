'use client';

import { SelectAttributeDefinition, SelectAttributeDefinitionCategory, SelectAttributeValue } from '@gredice/storage';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { AttributeInput } from './AttributeInput';
import { Button } from '@signalco/ui-primitives/Button';

export type AttributeTabsProps = {
    entity: { id: number, attributes: SelectAttributeValue[] },
    category: SelectAttributeDefinitionCategory,
    attributeDefinitions: SelectAttributeDefinition[],
    onValueSave: (entityId: number, attributeDefinition: SelectAttributeDefinition, attributeValueId?: number, newValue?: string | null) => Promise<void>,
    onValueDelete: (attributeValue: SelectAttributeValue) => Promise<void>,
};

export function AttributeCategoryDetails({ entity, category, attributeDefinitions, onValueSave, onValueDelete }: AttributeTabsProps) {
    const categoryAttributes = attributeDefinitions.filter(a => a.category === category.name);
    return (
        <Stack spacing={2}>
            <Typography level='h5'>{category.label}</Typography>
            <Stack spacing={3}>
                {categoryAttributes.map(attributeDefinition => {
                    return (
                        <Stack key={attributeDefinition.id} spacing={1}>
                            <Typography level='body1'>{attributeDefinition.label}</Typography>
                            <Stack spacing={1}>
                                {attributeDefinition.multiple ? (
                                    entity.attributes.filter(a => a.attributeDefinitionId === attributeDefinition.id).map(attributeValue => (
                                        <AttributeInput
                                            key={attributeValue.id}
                                            entityId={entity.id}
                                            attributeDefinition={attributeDefinition}
                                            attributeValue={attributeValue}
                                            upsertAttributeValue={onValueSave}
                                            deleteAttributeValue={onValueDelete} />
                                    ))
                                ) : (
                                    <AttributeInput
                                        entityId={entity.id}
                                        attributeDefinition={attributeDefinition}
                                        attributeValue={entity.attributes.find(a => a.attributeDefinitionId === attributeDefinition.id)}
                                        upsertAttributeValue={onValueSave}
                                        deleteAttributeValue={onValueDelete} />
                                )}
                                {attributeDefinition.multiple && (
                                    <Button onClick={() => onValueSave(entity.id, attributeDefinition)}>
                                        Dodaj
                                    </Button>
                                )}
                            </Stack>
                        </Stack>
                    );
                })}
            </Stack>
        </Stack>
    );
}