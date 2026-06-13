'use client';

import type { ComponentPropsWithoutRef, MouseEvent, ReactNode } from 'react';
import { useId, useState } from 'react';
import { cx } from '../utils';

type SwitchSize = 'sm' | 'md';

const switchSizeClassNames = {
    sm: {
        root: 'h-5 w-9 min-w-9',
        thumb: 'size-4 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
    },
    md: {
        root: 'h-6 w-11 min-w-11',
        thumb: 'size-5 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0',
    },
} satisfies Record<SwitchSize, { root: string; thumb: string }>;

export type SwitchProps = Omit<
    ComponentPropsWithoutRef<'button'>,
    'defaultChecked'
> & {
    checked?: boolean;
    defaultChecked?: boolean;
    description?: ReactNode;
    label?: ReactNode;
    onCheckedChange?: (checked: boolean) => void;
    readOnly?: boolean;
    size?: SwitchSize;
};

export function Switch({
    'aria-describedby': ariaDescribedBy,
    checked,
    className,
    defaultChecked,
    description,
    disabled,
    id,
    label,
    onClick,
    onCheckedChange,
    readOnly,
    size = 'md',
    type = 'button',
    ...props
}: SwitchProps) {
    const generatedId = useId();
    const switchId = id ?? generatedId;
    const descriptionId = description ? `${switchId}-description` : undefined;
    const describedBy = [ariaDescribedBy, descriptionId]
        .filter(Boolean)
        .join(' ');
    const [internalChecked, setInternalChecked] = useState(
        defaultChecked ?? false,
    );
    const isChecked = checked ?? internalChecked;
    const state = isChecked ? 'checked' : 'unchecked';

    function handleClick(event: MouseEvent<HTMLButtonElement>) {
        onClick?.(event);

        if (event.defaultPrevented || readOnly) {
            return;
        }

        const nextChecked = !isChecked;
        if (checked === undefined) {
            setInternalChecked(nextChecked);
        }
        onCheckedChange?.(nextChecked);
    }

    const control = (
        <button
            {...props}
            aria-describedby={describedBy || undefined}
            aria-checked={isChecked}
            aria-readonly={readOnly || undefined}
            className={cx(
                'peer relative inline-flex shrink-0 cursor-pointer items-center overflow-hidden rounded-full border border-border bg-muted/70 p-0 ring-offset-background transition-colors hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 data-[readonly]:cursor-default data-[state=checked]:border-primary/60 data-[state=checked]:bg-primary data-[state=checked]:hover:bg-primary/90',
                switchSizeClassNames[size].root,
                className,
            )}
            data-readonly={readOnly ? '' : undefined}
            data-state={state}
            disabled={disabled}
            id={switchId}
            onClick={handleClick}
            role="switch"
            type={type}
        >
            <span
                data-state={state}
                className={cx(
                    'pointer-events-none absolute left-0.5 top-1/2 block -translate-y-1/2 rounded-full border border-border/70 bg-background shadow-xs ring-0 transition-transform data-[state=checked]:border-primary-foreground/20 data-[state=checked]:bg-primary-foreground',
                    switchSizeClassNames[size].thumb,
                )}
            />
        </button>
    );

    if (!label && !description) {
        return control;
    }

    return (
        <div className="flex items-center gap-2">
            {control}
            <span
                className={cx(
                    'grid gap-0.5',
                    disabled && 'cursor-not-allowed opacity-70',
                )}
            >
                {label ? (
                    <label
                        className="text-sm font-medium leading-none"
                        htmlFor={switchId}
                    >
                        {label}
                    </label>
                ) : null}
                {description ? (
                    <span
                        className="text-muted-foreground text-xs leading-snug"
                        id={descriptionId}
                    >
                        {description}
                    </span>
                ) : null}
            </span>
        </div>
    );
}
