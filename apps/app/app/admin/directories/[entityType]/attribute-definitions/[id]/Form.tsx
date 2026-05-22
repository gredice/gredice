'use client';

import type { getAttributeDefinition } from '@gredice/storage';
import { Checkbox } from '@gredice/ui/Checkbox';
import { Input } from '@gredice/ui/Input';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { type ChangeEvent, useState } from 'react';
import { upsertAttributeDefinition } from '../../../../../(actions)/definitionActions';
import {
    attributeDataTypeItems,
    buildRangeDataType,
    getAttributeDataTypeLabel,
    parseRangeDataType,
} from '../AttributeDataTypes';

type GetAttributeDefinition = Exclude<
    Awaited<ReturnType<typeof getAttributeDefinition>>,
    undefined
>;

export function FormInput({
    definition,
    name,
    label,
    value,
    placeholder,
}: {
    definition: GetAttributeDefinition;
    name: string;
    label: string;
    value: string;
    placeholder?: string;
}) {
    const [internalValue, setValue] = useState(value);
    const handleChange = (e: ChangeEvent<HTMLInputElement>) =>
        setValue(e.target.value);
    const handleBlur = async () => {
        await upsertAttributeDefinition({
            id: definition.id,
            [name]:
                typeof internalValue === 'string' && internalValue.length > 0
                    ? internalValue
                    : null,
        });
    };
    return (
        <Input
            name={name}
            value={internalValue}
            label={label}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={placeholder}
        />
    );
}

export function FormDataTypeSelect({
    definition,
    value,
}: {
    definition: GetAttributeDefinition;
    value: string;
}) {
    const isInitialRangeDataType =
        value === 'range' || value.startsWith('range|');
    const [selectedDataType, setSelectedDataType] = useState(
        isInitialRangeDataType ? 'range' : value,
    );
    const parsedRangeDataType = parseRangeDataType(value);
    const [rangeMinValue, setRangeMinValue] = useState(parsedRangeDataType.min);
    const [rangeMaxValue, setRangeMaxValue] = useState(parsedRangeDataType.max);
    const isRangeDataType = selectedDataType === 'range';

    const handleValueChange = async (nextValue: string) => {
        setSelectedDataType(nextValue);

        const nextDataType =
            nextValue === 'range'
                ? buildRangeDataType(rangeMinValue, rangeMaxValue)
                : nextValue;
        await upsertAttributeDefinition({
            id: definition.id,
            dataType: nextDataType,
        });
    };

    const handleRangeBlur = async () => {
        if (!isRangeDataType) {
            return;
        }

        const rangeDataType = buildRangeDataType(rangeMinValue, rangeMaxValue);
        await upsertAttributeDefinition({
            id: definition.id,
            dataType: rangeDataType,
        });
    };

    const items = attributeDataTypeItems.some(
        (item) => item.value === selectedDataType,
    )
        ? attributeDataTypeItems
        : [
              ...attributeDataTypeItems,
              {
                  value: selectedDataType,
                  label: getAttributeDataTypeLabel(selectedDataType),
              },
          ];

    return (
        <Stack spacing={2} className="grow">
            <SelectItems
                label="Tip podatka"
                value={selectedDataType}
                onValueChange={handleValueChange}
                items={items}
                placeholder={getAttributeDataTypeLabel(value)}
            />
            {isRangeDataType && (
                <div className="grid grid-cols-2 gap-2">
                    <Input
                        type="number"
                        label="Minimalna vrijednost"
                        value={rangeMinValue}
                        onChange={(event) =>
                            setRangeMinValue(event.target.value)
                        }
                        onBlur={handleRangeBlur}
                    />
                    <Input
                        type="number"
                        label="Maksimalna vrijednost"
                        value={rangeMaxValue}
                        onChange={(event) =>
                            setRangeMaxValue(event.target.value)
                        }
                        onBlur={handleRangeBlur}
                    />
                </div>
            )}
        </Stack>
    );
}

export function FormCheckbox({
    definition,
    name,
    label,
    value,
}: {
    definition: GetAttributeDefinition;
    name: string;
    label: string;
    value?: string;
}) {
    const [internalValue, setValue] = useState(value === 'true');
    const handleOnCheckedChange = async (checked: boolean) => {
        setValue(!!checked);
        await upsertAttributeDefinition({
            id: definition.id,
            [name]: checked,
        });
    };
    return (
        <Checkbox
            name={name}
            checked={internalValue}
            label={label}
            onCheckedChange={handleOnCheckedChange}
        />
    );
}
