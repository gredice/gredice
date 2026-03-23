'use client';

import type { getAttributeDefinition } from '@gredice/storage';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { Input } from '@signalco/ui-primitives/Input';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { type ChangeEvent, useState } from 'react';
import { upsertAttributeDefinition } from '../../../../../(actions)/definitionActions';
import {
    attributeDataTypeItems,
    getAttributeDataTypeLabel,
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
    const [internalValue, setValue] = useState(value);

    const handleValueChange = async (nextValue: string) => {
        setValue(nextValue);
        await upsertAttributeDefinition({
            id: definition.id,
            dataType: nextValue,
        });
    };

    const items = attributeDataTypeItems.some(
        (item) => item.value === internalValue,
    )
        ? attributeDataTypeItems
        : [
              ...attributeDataTypeItems,
              {
                  value: internalValue,
                  label: getAttributeDataTypeLabel(internalValue),
              },
          ];

    return (
        <Stack spacing={0.5}>
            <Typography level="body2">Tip podatka</Typography>
            <SelectItems
                value={internalValue}
                onValueChange={handleValueChange}
                items={items}
                placeholder={getAttributeDataTypeLabel(value)}
            />
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
