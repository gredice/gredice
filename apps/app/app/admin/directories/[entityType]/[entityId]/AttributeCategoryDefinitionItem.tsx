'use client';

import type {
    SelectAttributeDefinition,
    SelectAttributeValue,
} from '@gredice/storage';
import { Button } from '@signalco/ui-primitives/Button';
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
            <Row justifyContent="space-between" alignItems="flex-start">
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
                {attributeDefinition.multiple && (
                    <Button onClick={handleAdd}>Dodaj</Button>
                )}
            </Row>
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
            </Stack>
        </Stack>
    );
}
