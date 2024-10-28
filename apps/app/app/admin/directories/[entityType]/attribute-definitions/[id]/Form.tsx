'use client';

import { Checkbox } from "@signalco/ui-primitives/Checkbox";
import { upsertAttributeDefinition } from "../../../../../(actions)/definitionActions";
import { useState } from "react";
import { Input } from "@signalco/ui-primitives/Input";
import { getAttributeDefinition } from "@gredice/storage";

type GetAttributeDefinition = Exclude<Awaited<ReturnType<typeof getAttributeDefinition>>, undefined>;

export function FormInput({ definition, name, label, value }: { definition: GetAttributeDefinition, name: string, label: string, value: string }) {
    const [internalValue, setValue] = useState(value);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value);
    const handleBlur = async () => {
        const changed = {
            id: definition.id,
            [name]: internalValue
        };
        await upsertAttributeDefinition(changed as any);
    }
    return (
        <Input name={name} value={internalValue} label={label} onChange={handleChange} onBlur={handleBlur} />
    );
}

export function FormCheckbox({ definition, name, label, value }: { definition: GetAttributeDefinition, name: string, label: string, value?: string }) {
    const [internalValue, setValue] = useState(value === 'true');
    const handleOnCheckedChange = async (checked: boolean) => {
        setValue(checked ? true : false);
        const changed = {
            id: definition.id,
            [name]: checked
        };
        await upsertAttributeDefinition(changed as any);
    }
    return (
        <Checkbox name={name} checked={internalValue} label={label}
            onCheckedChange={handleOnCheckedChange}
        />
    );
}
