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
                'flex w-full min-w-0 flex-col gap-1.5 text-sm',
                align === 'end' ? 'items-end' : 'items-start',
                className,
            )}
            data-align={align}
            data-chat-message=""
            {...props}
        >
            {(avatar || header) && (
                <div
                    className={cx(
                        'flex max-w-full min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground',
                        align === 'end' && 'flex-row-reverse',
                    )}
                    data-chat-message-header=""
                >
                    {avatar && (
                        <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                            {avatar}
                        </div>
                    )}
                    {header && <div className="min-w-0">{header}</div>}
                </div>
            )}
            {children}
            {footer && (
                <div className="max-w-full min-w-0 px-1 text-xs text-muted-foreground">
                    {footer}
                </div>
            )}
        </div>
    );
}
