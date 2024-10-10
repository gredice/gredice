'use client';

import { Input } from '@signalco/ui-primitives/Input';
import { useState } from 'react';
import { AttributeInputProps } from '../AttributeInputProps';

export function TextInput({ value, onChange }: AttributeInputProps) {
    const [inputValue, setInputValue] = useState<string>(value || '');
    const handleOnChange = (newValue: string) => {
        setInputValue(newValue);
    }
    const handleOnBlur = () => {
        onChange(inputValue || null);
    }
    return (
        <Input
            placeholder={"Nema informacija..."}
            value={inputValue}
            onChange={(e) => handleOnChange(e.target.value)}
            onBlur={handleOnBlur}
            fullWidth />
    );
}