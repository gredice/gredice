'use client';

import { Checkbox } from "@signalco/ui-primitives/Checkbox";
import { upsertAttributeDefinition } from "../../../../../(actions)/definitionActions";
import { ChangeEvent, useState } from "react";
import { Input } from "@signalco/ui-primitives/Input";
import { getAttributeDefinition } from "@gredice/storage";

type GetAttributeDefinition = Exclude<Awaited<ReturnType<typeof getAttributeDefinition>>, undefined>;

export function FormInput({ definition, name, label, value, placeholder }: { definition: GetAttributeDefinition, name: string, label: string, value: string, placeholder?: string }) {
    const [internalValue, setValue] = useState(value);
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => setValue(e.target.value);
    const handleBlur = async () => {
        await upsertAttributeDefinition({
            id: definition.id,
            [name]: typeof internalValue === 'string' && internalValue.length > 0 ? internalValue : null
        });
    }
    return (
        <Input name={name} value={internalValue} label={label} onChange={handleChange} onBlur={handleBlur} placeholder={placeholder} />
    );
}

export function FormCheckbox({ definition, name, label, value }: { definition: GetAttributeDefinition, name: string, label: string, value?: string }) {
    const [internalValue, setValue] = useState(value === 'true');
    const handleOnCheckedChange = async (checked: boolean) => {
        setValue(checked ? true : false);
        await upsertAttributeDefinition({
            id: definition.id,
            [name]: checked
        });
    }
    return (
        <Checkbox name={name} checked={internalValue} label={label}
            onCheckedChange={handleOnCheckedChange}
        />
    );
}
