'use client';

import { useState } from 'react';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { AttributeInputProps } from '../AttributeInputProps';

export function BooleanInput({ value, onChange }: AttributeInputProps) {
    const [inputValue, setInputValue] = useState<string>(value || 'false');
    const handleOnCheckedChange = (checked: boolean) => {
        setInputValue(checked ? 'true' : 'false');
        onChange(checked ? 'true' : 'false');
    }

    return (
        <Checkbox
            checked={inputValue === 'true'}
            onCheckedChange={handleOnCheckedChange}
        />
    )
}