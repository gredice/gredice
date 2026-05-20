import { Input } from '@signalco/ui-primitives/Input';
import { useState } from 'react';
import type { AttributeInputProps } from '../AttributeInputProps';
import { attributeUnitDecorator } from './AttributeUnitDecorator';

export function TextInput({
    value,
    onChange,
    attributeDefinition,
}: AttributeInputProps) {
    const [inputValue, setInputValue] = useState<string>(value || '');
    const handleOnChange = (newValue: string) => {
        setInputValue(newValue);
    };
    const handleOnBlur = () => {
        onChange(inputValue || null);
    };
    return (
        <Input
            placeholder={'Nema informacija...'}
            value={inputValue}
            onChange={(e) => handleOnChange(e.target.value)}
            onBlur={handleOnBlur}
            fullWidth
            className="max-w-xl"
            endDecorator={attributeUnitDecorator(attributeDefinition?.unit)}
        />
    );
}
