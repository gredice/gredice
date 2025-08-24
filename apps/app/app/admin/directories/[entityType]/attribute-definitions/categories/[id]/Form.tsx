'use client';

import type { getAttributeDefinitionCategories } from '@gredice/storage';
import { Input } from '@signalco/ui-primitives/Input';
import { type ChangeEvent, useState } from 'react';
import { upsertAttributeDefinitionCategory } from '../../../../../../(actions)/definitionActions';

type GetAttributeDefinitionCategory = Exclude<
    Awaited<ReturnType<typeof getAttributeDefinitionCategories>>[0],
    undefined
>;

export function FormInput({
    category,
    name,
    label,
    value,
}: {
    category: GetAttributeDefinitionCategory;
    name: string;
    label: string;
    value: string;
}) {
    const [internalValue, setValue] = useState(value);
    const handleChange = (e: ChangeEvent<HTMLInputElement>) =>
        setValue(e.target.value);
    const handleBlur = async () => {
        await upsertAttributeDefinitionCategory({
            id: category.id,
            [name]: internalValue,
        });
    };
    return (
        <Input
            name={name}
            value={internalValue}
            label={label}
            onChange={handleChange}
            onBlur={handleBlur}
        />
    );
}
