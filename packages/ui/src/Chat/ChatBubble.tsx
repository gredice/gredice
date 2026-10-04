import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cx } from '../utils';

const chatBubbleVariants = cva(
    'w-fit max-w-[82%] min-w-0 overflow-hidden rounded-2xl border px-3.5 py-2.5 text-sm leading-relaxed wrap-break-word',
    {
        variants: {
            variant: {
                default:
                    'border-transparent bg-primary text-primary-foreground',
                secondary:
                    'border-transparent bg-secondary text-secondary-foreground',
                muted: 'border-transparent bg-muted text-foreground',
                sunflower:
                    'border-amber-200/80 bg-amber-100/90 text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-100',
                outline: 'border-border bg-background text-foreground',
                ghost: 'max-w-full rounded-none border-transparent bg-transparent p-0 text-foreground',
                destructive:
                    'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/60 dark:text-red-100',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    },
);

export type ChatBubbleProps = HTMLAttributes<HTMLDivElement> &
    VariantProps<typeof chatBubbleVariants> & {
        align?: 'start' | 'end';
    };

export function ChatBubble({
    align = 'start',
    className,
    variant = 'default',
    ...props
}: ChatBubbleProps) {
    return (
        <div
            className={cx(
                chatBubbleVariants({ variant }),
                align === 'end' && 'self-end',
                className,
            )}
            data-align={align}
            data-chat-bubble=""
            data-variant={variant}
            {...props}
        />
    );
}
