import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../utils';

export type ChatMarkerProps = HTMLAttributes<HTMLDivElement> & {
    icon?: ReactNode;
    variant?: 'default' | 'border' | 'separator';
};

export function ChatMarker({
    children,
    className,
    icon,
    variant = 'default',
    ...props
}: ChatMarkerProps) {
    return (
        <div
            className={cx(
                'flex min-h-4 w-full items-center gap-2 text-left text-xs text-muted-foreground',
                variant === 'border' && 'border-b border-border pb-2',
                variant === 'separator' &&
                    'before:mr-1 before:h-px before:min-w-0 before:flex-1 before:bg-border after:ml-1 after:h-px after:min-w-0 after:flex-1 after:bg-border',
                className,
            )}
            data-chat-marker=""
            data-variant={variant}
            {...props}
        >
            {icon && (
                <span
                    aria-hidden="true"
                    className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4"
                >
                    {icon}
                </span>
            )}
            <span
                className={cx(
                    'min-w-0 wrap-break-word',
                    variant === 'separator' && 'flex-none text-center',
                )}
            >
                {children}
            </span>
        </div>
    );
}
