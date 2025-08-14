import { AttributeInputProps } from '../AttributeInputProps';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { useEffect, useState } from 'react';
import { getEntities } from '../actions/entitiesActions';

export function SelectEntity({ value, onChange, attributeDefinition }: AttributeInputProps) {
    const entityTypeName = attributeDefinition?.dataType.split(':')[1];
    const [entities, setEntities] = useState<Awaited<ReturnType<typeof getEntities>>>();

    useEffect(() => {
        if (!entityTypeName) {
            return;
        }

        getEntities(entityTypeName)
            .then((response) => {
                setEntities(response);
            })
            .catch((error) => {
                console.error('Error fetching entities:', error);
            });
    }, [entityTypeName]);

    const items = [
        { value: '-', label: '-' },
        ...(entities?.map((entity, entityIndex) => ({
            value: entity.information?.name ?? entityIndex.toString(),
            label: (entity.information?.label ?? entity.information?.name) ?? `${entityTypeName} ${entityIndex + 1}`,
        })) ?? []),
    ]

    const handleOnChange = (newValue: string) => {
        onChange(newValue !== '-' ? newValue : null);
    }

    return (
        <SelectItems
            items={items}
            value={value ?? '-'}
            onValueChange={handleOnChange}
        />
    );
}