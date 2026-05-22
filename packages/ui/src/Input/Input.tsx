import { type InputHTMLAttributes, type ReactNode, useId } from 'react';
import { cx } from '../utils';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
    startDecorator?: ReactNode;
    endDecorator?: ReactNode;
    label?: string;
    helperText?: string;
    fullWidth?: boolean;
    variant?: 'soft' | 'outlined' | 'plain';
};

const variantClassNames = {
    outlined: 'border border-input bg-background',
    soft: 'border border-transparent bg-muted',
    plain: 'border border-transparent bg-transparent',
};

export function Input({
    className,
    endDecorator,
    fullWidth,
    helperText,
    id,
    label,
    name,
    startDecorator,
    variant = 'outlined',
    ...rest
}: InputProps) {
    const generatedId = useId();
    const inputId = id ?? name ?? generatedId;
    const input = (
        <div
            className={cx(
                'flex h-10 items-center rounded-md ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                variantClassNames[variant],
                fullWidth ? 'w-full' : 'w-fit',
                className,
            )}
        >
            {startDecorator}
            <input
                id={inputId}
                name={name}
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-hidden placeholder:text-current placeholder:opacity-50 disabled:cursor-not-allowed disabled:opacity-50"
                {...rest}
            />
            {endDecorator}
        </div>
    );

    return (
        <div className={cx('space-y-1', fullWidth && 'w-full')}>
            {label ? (
                <label
                    htmlFor={inputId}
                    className="block text-sm font-medium text-foreground"
                >
                    {label}
                </label>
            ) : null}
            {input}
            {helperText ? (
                <p className="text-xs text-muted-foreground">{helperText}</p>
            ) : null}
        </div>
    );
}
