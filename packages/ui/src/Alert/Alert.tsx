import type { HTMLAttributes, ReactNode } from 'react';
import { Row } from '../Row';
import { cx } from '../utils';

export type AlertColor =
    | 'primary'
    | 'neutral'
    | 'danger'
    | 'info'
    | 'success'
    | 'warning';

export type AlertProps = HTMLAttributes<HTMLDivElement> & {
    color?: AlertColor;
    startDecorator?: ReactNode;
    endDecorator?: ReactNode;
};

const colorClassNames = {
    primary: 'border-primary/30 bg-primary/10 text-foreground',
    neutral:
        'border-border bg-muted text-foreground dark:bg-neutral-900 dark:border-neutral-700',
    danger: 'border-red-300 bg-red-100 text-red-950 dark:border-red-800 dark:bg-red-950 dark:text-red-100',
    info: 'border-blue-300 bg-blue-100 text-blue-950 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100',
    success:
        'border-green-300 bg-green-100 text-green-950 dark:border-green-800 dark:bg-green-950 dark:text-green-100',
    warning:
        'border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
} satisfies Record<AlertColor, string>;

export function Alert({
    children,
    className,
    color = 'neutral',
    endDecorator,
    startDecorator,
    ...rest
}: AlertProps) {
    return (
        <Row
            alignItems="center"
            className={cx(
                'relative w-full rounded-lg border px-3 py-2 text-sm',
                colorClassNames[color],
                className,
            )}
            role="alert"
            spacing={4}
            {...rest}
        >
            {startDecorator ? (
                <span className="shrink-0">{startDecorator}</span>
            ) : null}
            <div className="min-w-0 grow [&_p]:leading-relaxed">{children}</div>
            {endDecorator ? (
                <span className="shrink-0">{endDecorator}</span>
            ) : null}
        </Row>
    );
}
