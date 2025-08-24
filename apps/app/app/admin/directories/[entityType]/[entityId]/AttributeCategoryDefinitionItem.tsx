'use client';

import type {
    SelectAttributeDefinition,
    SelectAttributeValue,
} from '@gredice/storage';
import { Button } from '@signalco/ui-primitives/Button';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { AttributeInput } from '../../../../../components/shared/attributes/AttributeInput';
import { handleValueSave } from '../../../../(actions)/entityActions';

type AttributeCategoryDefinitionItemProps = {
    entity: {
        id: number;
        entityTypeName: string;
        attributes: SelectAttributeValue[];
    };
    attributeDefinition: SelectAttributeDefinition;
};

export function AttributeCategoryDefinitionItem({
    attributeDefinition,
    entity,
}: AttributeCategoryDefinitionItemProps) {
    return (
        <Stack key={attributeDefinition.id} spacing={1}>
            <Stack>
                <Typography level="body1" semiBold>
                    {attributeDefinition.label}
                    {attributeDefinition.required && (
                        <span className="text-red-600/60 ml-1">*</span>
                    )}
                </Typography>
                {Boolean(attributeDefinition.description?.length) && (
                    <Typography level="body2">
                        {attributeDefinition.description}
                    </Typography>
                )}
            </Stack>
            <Stack spacing={1}>
                {attributeDefinition.multiple ? (
                    entity.attributes
                        .filter(
                            (a) =>
                                a.attributeDefinitionId ===
                                attributeDefinition.id,
                        )
                        .map((attributeValue) => (
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
                        attributeValue={entity.attributes.find(
                            (a) =>
                                a.attributeDefinitionId ===
                                attributeDefinition.id,
                        )}
                    />
                )}
                {attributeDefinition.multiple && (
                    <Button
                        onClick={() =>
                            handleValueSave(
                                entity.entityTypeName,
                                entity.id,
                                attributeDefinition,
                            )
                        }
                    >
                        Dodaj
                    </Button>
                )}
            </Stack>
        </Stack>
    );
}
