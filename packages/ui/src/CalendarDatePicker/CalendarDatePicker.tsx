'use client';

import {
    type ButtonHTMLAttributes,
    type ReactElement,
    type ReactNode,
    useId,
    useState,
} from 'react';
import { Calendar as CalendarIcon } from '../icons';
import { Popper, type PopperProps } from '../Popper';
import { cx } from '../utils';
import { Calendar } from './Calendar';
import { parseCalendarDateKey } from './calendarDateUtils';

const displayDateFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
});

const variantClassNames = {
    outlined: 'border border-input bg-background',
    soft: 'border border-transparent bg-muted',
    plain: 'border border-transparent bg-transparent',
};

export type CalendarDatePickerProps = Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    'children' | 'defaultValue' | 'onChange' | 'value'
> & {
    align?: PopperProps['align'];
    calendarClassName?: string;
    children?: ReactNode;
    closeOnSelect?: boolean;
    fullWidth?: boolean;
    helperText?: ReactNode;
    label?: ReactNode;
    max?: string;
    min?: string;
    name?: string;
    onOpenChange?: (open: boolean) => void;
    onValueChange: (value: string) => void;
    open?: boolean;
    placeholder?: ReactNode;
    popoverClassName?: string;
    popoverContainer?: HTMLElement;
    required?: boolean;
    side?: PopperProps['side'];
    trigger?: ReactElement;
    value: string;
    variant?: keyof typeof variantClassNames;
};

export function CalendarDatePicker({
    align,
    calendarClassName,
    children,
    className,
    closeOnSelect = true,
    disabled,
    fullWidth,
    helperText,
    id,
    label,
    max,
    min,
    name,
    onOpenChange,
    onValueChange,
    open,
    placeholder = 'Odaberi datum',
    popoverClassName,
    popoverContainer,
    required,
    side,
    trigger,
    value,
    variant = 'outlined',
    ...buttonProps
}: CalendarDatePickerProps) {
    const generatedId = useId();
    const inputId = id ?? name ?? generatedId;
    const [internalOpen, setInternalOpen] = useState(false);
    const resolvedOpen = open ?? internalOpen;
    const selectedDate = parseCalendarDateKey(value);
    const valueLabel = selectedDate
        ? displayDateFormatter.format(selectedDate)
        : placeholder;
    const helperTextId = helperText ? `${inputId}-helper` : undefined;
    const describedBy = [buttonProps['aria-describedby'], helperTextId]
        .filter(Boolean)
        .join(' ');
    const accessibleLabel =
        buttonProps['aria-label'] ??
        (typeof label === 'string' ? `${label}: ${valueLabel}` : undefined);

    function handleOpenChange(nextOpen: boolean) {
        if (open === undefined) {
            setInternalOpen(nextOpen);
        }
        onOpenChange?.(nextOpen);
    }

    const defaultTrigger = (
        <button
            {...buttonProps}
            aria-describedby={describedBy || undefined}
            aria-label={accessibleLabel}
            className={cx(
                'flex h-10 items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm ring-offset-background transition-colors',
                'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                variantClassNames[variant],
                fullWidth ? 'w-full' : 'w-fit',
                !selectedDate && 'text-muted-foreground',
                className,
            )}
            disabled={disabled}
            id={inputId}
            type="button"
        >
            <span className="min-w-0 truncate">{valueLabel}</span>
            <CalendarIcon
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground"
            />
        </button>
    );

    return (
        <div className={cx('space-y-1', fullWidth && 'w-full')}>
            {label ? (
                <label
                    className="block text-sm font-medium text-foreground"
                    htmlFor={inputId}
                >
                    {label}
                </label>
            ) : null}
            {name ? (
                <input
                    disabled={disabled}
                    name={name}
                    required={required}
                    type="hidden"
                    value={value}
                />
            ) : null}
            <Popper
                align={align}
                className={cx('w-72 p-3', popoverClassName)}
                container={popoverContainer}
                onOpenChange={handleOpenChange}
                open={resolvedOpen}
                side={side}
                sideOffset={8}
                trigger={trigger ?? defaultTrigger}
            >
                <Calendar
                    className={calendarClassName}
                    disabled={disabled}
                    max={max}
                    min={min}
                    onValueChange={(nextValue) => {
                        onValueChange(nextValue);
                        if (closeOnSelect) {
                            handleOpenChange(false);
                        }
                    }}
                    value={value}
                />
                {children ? <div className="mt-3">{children}</div> : null}
            </Popper>
            {helperText ? (
                <div
                    className="text-xs text-muted-foreground"
                    id={helperTextId}
                >
                    {helperText}
                </div>
            ) : null}
        </div>
    );
}
