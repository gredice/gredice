'use client';

import { useControllableState } from '@signalco/hooks/useControllableState';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { useEffect, useState } from 'react';
import { getEntities } from '../../../../components/shared/attributes/actions/entitiesActions';

export type SelectEntityProps = {
    value?: string | null;
    defaultValue?: string | null;
    onChange?: (value: string | null) => void;
    entityTypeName?: string;
    name?: string;
    label?: string;
    required?: boolean;
};

export function SelectEntity({
    value,
    defaultValue,
    onChange,
    entityTypeName,
    name,
    label,
    required,
}: SelectEntityProps) {
    const [internalValue, setValue] = useControllableState(
        value,
        defaultValue,
        onChange,
    );
    const [entities, setEntities] =
        useState<Awaited<ReturnType<typeof getEntities>>>();

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
            value: entity.id?.toString() ?? entityIndex.toString(),
            label:
                entity.information?.label ??
                entity.information?.name ??
                `${entityTypeName} ${entityIndex + 1}`,
        })) ?? []),
    ];

    const handleOnChange = (newValue: string) => {
        setValue(newValue !== '-' ? newValue : null);
    };

    return (
        <>
            <input type="hidden" name={name} value={internalValue ?? ''} />
            <SelectItems
                items={items}
                value={internalValue ?? '-'}
                onValueChange={handleOnChange}
                label={label}
                required={required}
            />
        </>
    );
}
