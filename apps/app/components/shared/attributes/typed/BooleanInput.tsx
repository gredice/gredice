import { cx } from '@gredice/ui/utils';
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
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={handleToggle}
            className={cx(
                'relative flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                checked
                    ? 'border-primary/60 bg-primary'
                    : 'border-border bg-muted/70 hover:bg-muted',
            )}
        >
            <span
                className={cx(
                    'inline-block size-5 rounded-full shadow-sm transition-transform',
                    checked
                        ? 'translate-x-5 bg-primary-foreground'
                        : 'translate-x-0.5 bg-muted-foreground',
                )}
            />
            <span className="sr-only">{checked ? 'Da' : 'Ne'}</span>
        </button>
    );
}
