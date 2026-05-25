'use client';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { type ComponentPropsWithoutRef, type ReactNode, useId } from 'react';
import { cx } from '../utils';

export type CheckboxProps = ComponentPropsWithoutRef<
    typeof CheckboxPrimitive.Root
> & {
    label?: ReactNode;
    disableIcon?: boolean;
    readOnly?: boolean;
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
    const readOnlyChecked = checked ?? defaultChecked ?? false;

    return (
        <div className="flex items-center space-x-2">
            <CheckboxPrimitive.Root
                aria-readonly={readOnly || undefined}
                checked={readOnly ? readOnlyChecked : checked}
                className={cx(
                    'peer size-4 shrink-0 border border-primary ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[readonly]:cursor-default data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground',
                    variant === 'circle' ? 'rounded-full' : 'rounded-xs',
                    className,
                )}
                data-readonly={readOnly ? '' : undefined}
                defaultChecked={readOnly ? undefined : defaultChecked}
                disabled={disabled}
                id={checkboxId}
                onCheckedChange={readOnly ? undefined : onCheckedChange}
                {...props}
            >
                {!disableIcon && (
                    <CheckboxPrimitive.Indicator className="group flex items-center justify-center text-current">
                        <Check
                            aria-hidden
                            className="size-4 group-data-[state=indeterminate]:hidden"
                        />
                        <Minus
                            aria-hidden
                            className="hidden size-4 group-data-[state=indeterminate]:block"
                        />
                    </CheckboxPrimitive.Indicator>
                )}
            </CheckboxPrimitive.Root>
            {label ? (
                <label
                    className="grow text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    htmlFor={checkboxId}
                >
                    {label}
                </label>
            ) : null}
        </div>
    );
}
