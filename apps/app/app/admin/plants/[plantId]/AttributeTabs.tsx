'use client';

import { SelectAttributeDefinition, SelectAttributeValue } from '@gredice/storage';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { camelToSentenceCase } from '@signalco/js';
import { AttributeInput } from './AttributeInput';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@signalco/ui-primitives/Tabs';
import { Button } from '@signalco/ui-primitives/Button';

export type AttributeTabsProps = {
    entity: { id: number, attributes: SelectAttributeValue[] },
    attributeCategories: string[],
    attributeDefinitions: SelectAttributeDefinition[],
    onValueSave: (entityId: number, attributeDefinition: SelectAttributeDefinition, attributeValueId?: number, newValue?: string | null) => Promise<void>,
    onValueDelete: (attributeValue: SelectAttributeValue) => Promise<void>,
};

export function AttributeTabs({ entity, attributeCategories, attributeDefinitions, onValueSave, onValueDelete }: AttributeTabsProps) {
    return (
        <Tabs defaultValue={attributeCategories.at(0)}>
            <div className='flex justify-center'>
                <TabsList>
                    {attributeCategories.map((category) => (
                        <TabsTrigger key={category} value={category}>{camelToSentenceCase(category)}</TabsTrigger>
                    ))}
                </TabsList>
            </div>
            {attributeCategories.map((category) => {
                const categoryAttributes = attributeDefinitions.filter(a => a.category === category);
                return (
                    <TabsContent value={category}>
                        <Stack spacing={2}>
                            <Typography level='h5'>{camelToSentenceCase(category)}</Typography>
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
                    </TabsContent>
                );
            })}
        </Tabs>
    );
}