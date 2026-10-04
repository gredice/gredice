import { Switch } from '@gredice/ui/Switch';
import { useState } from 'react';
import type { AttributeInputProps } from '../AttributeInputProps';

export function BooleanInput({ value, onChange }: AttributeInputProps) {
    const [inputValue, setInputValue] = useState<string>(value || 'false');
    const checked = inputValue === 'true';

    const handleToggle = () => {
        const nextValue = checked ? 'false' : 'true';
        setInputValue(nextValue);
        onChange(nextValue);
    };

    return (
        <Switch
            aria-label={checked ? 'Da' : 'Ne'}
            checked={checked}
            onCheckedChange={handleToggle}
        />
    );
}
