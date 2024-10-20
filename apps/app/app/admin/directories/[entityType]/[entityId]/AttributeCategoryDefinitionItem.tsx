'use client';

import { SelectAttributeValue, SelectAttributeDefinition } from "@gredice/storage";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { AttributeInput } from "../../../../../components/shared/attributes/AttributeInput";
import { handleValueSave } from "../../../../(actions)/entityActions";
import { Button } from "@signalco/ui-primitives/Button";

type AttributeCategoryDefinitionItemProps = {
    entity: { id: number, entityTypeName: string, attributes: SelectAttributeValue[] },
    attributeDefinition: SelectAttributeDefinition
}

export function AttributeCategoryDefinitionItem({ attributeDefinition, entity }: AttributeCategoryDefinitionItemProps) {
    return (
        <Stack key={attributeDefinition.id} spacing={1}>
            <Typography level='body1' semiBold>{attributeDefinition.label}</Typography>
            <Stack spacing={1}>
                {attributeDefinition.multiple ? (
                    entity.attributes.filter(a => a.attributeDefinitionId === attributeDefinition.id).map(attributeValue => (
                        <AttributeInput
                            key={attributeValue.id}
                            entityType={entity.entityTypeName}
                            entityId={entity.id}
                            attributeDefinition={attributeDefinition}
                            attributeValue={attributeValue}
                        />
                    ))
                ) : (
                    <AttributeInput
                        entityId={entity.id}
                        entityType={entity.entityTypeName}
                        attributeDefinition={attributeDefinition}
                        attributeValue={entity.attributes.find(a => a.attributeDefinitionId === attributeDefinition.id)}
                    />
                )}
                {attributeDefinition.multiple && (
                    <Button onClick={() => handleValueSave(entity.entityTypeName, entity.id, attributeDefinition)}>
                        Dodaj
                    </Button>
                )}
            </Stack>
        </Stack>
    );
}
