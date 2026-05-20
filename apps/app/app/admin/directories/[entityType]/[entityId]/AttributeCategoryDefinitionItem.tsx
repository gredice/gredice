'use client';

import type {
    SelectAttributeDefinition,
    SelectAttributeValue,
} from '@gredice/storage';
import { Add } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { AttributeInput } from '../../../../../components/shared/attributes/AttributeInput';
import { handleValueSave } from '../../../../(actions)/entityActions';
import { useEntityDetailsSave } from './EntityDetailsSaveContext';

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
    const { trackSave } = useEntityDetailsSave();
    const attributeValues = entity.attributes.filter(
        (attribute) =>
            attribute.attributeDefinitionId === attributeDefinition.id,
    );

    function handleAdd() {
        void trackSave(() =>
            handleValueSave(
                entity.entityTypeName,
                entity.id,
                attributeDefinition,
            ),
        ).catch((error) => {
            console.error(
                'AttributeCategoryDefinitionItem handleAdd error',
                error,
            );
        });
    }

    return (
        <Stack key={attributeDefinition.id} spacing={1}>
            <Row justifyContent="space-between" alignItems="start">
                <Stack>
                    <Typography level="body1" semiBold>
                        {attributeDefinition.label}
                        {attributeDefinition.required && (
                            <span className="ml-0.5 text-red-600/60">*</span>
                        )}
                    </Typography>
                    {Boolean(attributeDefinition.description?.length) && (
                        <Typography level="body2">
                            {attributeDefinition.description}
                        </Typography>
                    )}
                </Stack>
                {attributeDefinition.multiple && (
                    <IconButton
                        type="button"
                        onClick={handleAdd}
                        variant="plain"
                        title="Dodaj"
                    >
                        <Add className="size-5" />
                    </IconButton>
                )}
            </Row>
            {attributeDefinition.multiple ? (
                attributeValues.length > 0 && (
                    <div className="overflow-hidden rounded-lg border border-border/70">
                        {attributeValues.map((attributeValue) => (
                            <div
                                key={attributeValue.id}
                                className="border-border/70 border-b p-4 first:rounded-t-lg last:rounded-b-lg last:border-b-0"
                            >
                                <AttributeInput
                                    entityType={entity.entityTypeName}
                                    entityId={entity.id}
                                    attributeDefinition={attributeDefinition}
                                    attributeValue={attributeValue}
                                    presentation="list-item"
                                />
                            </div>
                        ))}
                    </div>
                )
            ) : (
                <AttributeInput
                    entityId={entity.id}
                    entityType={entity.entityTypeName}
                    attributeDefinition={attributeDefinition}
                    attributeValue={
                        attributeValues.length > 0
                            ? attributeValues[0]
                            : undefined
                    }
                />
            )}
        </Stack>
    );
}
