'use client';

import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { Check, Minus } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { useId, useState } from 'react';
import type { UiCheckedState } from '../lib/primitiveTypes';
import { cx } from '../utils';

export type CheckboxProps = Omit<
    HTMLAttributes<HTMLElement>,
    'checked' | 'defaultChecked' | 'onChange'
> & {
    checked?: UiCheckedState;
    defaultChecked?: UiCheckedState;
    disabled?: boolean;
    form?: string;
    label?: ReactNode;
    disableIcon?: boolean;
    name?: string;
    onCheckedChange?(checked: UiCheckedState): void;
    readOnly?: boolean;
    required?: boolean;
    value?: string;
    variant?: 'default' | 'circle';
};

export function Checkbox({
    checked,
    className,
    defaultChecked,
    disabled,
    disableIcon,
    id,
    label,
    onCheckedChange,
    readOnly,
    variant = 'default',
    ...props
}: CheckboxProps) {
    const generatedId = useId();
    const checkboxId = id ?? generatedId;
    const [defaultIndeterminate, setDefaultIndeterminate] = useState(
        defaultChecked === 'indeterminate',
    );
    const indeterminate =
        checked === undefined
            ? defaultIndeterminate
            : checked === 'indeterminate';

    function handleCheckedChange(nextChecked: boolean) {
        if (checked === undefined && defaultIndeterminate) {
            setDefaultIndeterminate(false);
        }

        onCheckedChange?.(nextChecked);
    }

    return (
        <div className="flex items-center space-x-2">
            <CheckboxPrimitive.Root
                checked={checked === undefined ? undefined : checked === true}
                className={cx(
                    'peer size-4 shrink-0 border border-primary ring-offset-background transition-colors has-[:focus-visible]:outline-hidden has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[readonly]:cursor-default data-[checked]:bg-primary data-[checked]:text-primary-foreground data-[indeterminate]:bg-primary data-[indeterminate]:text-primary-foreground',
                    variant === 'circle' ? 'rounded-full' : 'rounded-xs',
                    className,
                )}
                defaultChecked={defaultChecked === true}
                disabled={disabled}
                id={checkboxId}
                indeterminate={indeterminate}
                onCheckedChange={handleCheckedChange}
                readOnly={readOnly}
                {...props}
            >
                {!disableIcon && (
                    <CheckboxPrimitive.Indicator className="group flex items-center justify-center text-current">
                        <Check
                            aria-hidden
                            className="size-4 group-data-[indeterminate]:hidden"
                        />
                        <Minus
                            aria-hidden
                            className="hidden size-4 group-data-[indeterminate]:block"
                        />
                    </CheckboxPrimitive.Indicator>
                )}
            </CheckboxPrimitive.Root>
            {label ? (
                <label
                    className="grow text-sm font-medium leading-none peer-data-[disabled]:cursor-not-allowed peer-data-[disabled]:opacity-70"
                    htmlFor={checkboxId}
                >
                    {label}
                </label>
            ) : null}
        </div>
    );
}
