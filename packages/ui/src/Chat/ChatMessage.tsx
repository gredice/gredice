import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../utils';

export type ChatMessageProps = HTMLAttributes<HTMLDivElement> & {
    align?: 'start' | 'end';
    avatar?: ReactNode;
    footer?: ReactNode;
    header?: ReactNode;
};

export function ChatMessage({
    align = 'start',
    avatar,
    children,
    className,
    footer,
    header,
    ...props
}: ChatMessageProps) {
    return (
        <div
            className={cx(
                'flex w-full min-w-0 gap-2 text-sm',
                align === 'end' && 'flex-row-reverse',
                className,
            )}
            data-align={align}
            data-chat-message=""
            {...props}
        >
            {avatar && (
                <div className="flex size-8 shrink-0 items-center justify-center self-end overflow-hidden rounded-full border border-border bg-muted">
                    {avatar}
                </div>
            )}
            <div
                className={cx(
                    'flex min-w-0 flex-1 flex-col gap-1.5',
                    align === 'end' ? 'items-end' : 'items-start',
                )}
            >
                {header && (
                    <div className="max-w-full min-w-0 px-1 text-xs font-medium text-muted-foreground">
                        {header}
                    </div>
                )}
                {children}
                {footer && (
                    <div className="max-w-full min-w-0 px-1 text-xs text-muted-foreground">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
