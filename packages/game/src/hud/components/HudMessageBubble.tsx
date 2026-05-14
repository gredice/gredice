'use client';

import { cx } from '@signalco/ui-primitives/cx';
import type { ReactNode } from 'react';

export type HudMessageBubblePosition = 'left' | 'right' | 'top' | 'bottom';
export type HudMessageBubbleVariant = 'default' | 'green';

type HudMessageBubbleProps = {
    children: ReactNode;
    position?: HudMessageBubblePosition;
    variant?: HudMessageBubbleVariant;
    onClick?: () => void;
    className?: string;
};

const positionClasses: Record<HudMessageBubblePosition, string> = {
    right: 'left-full ml-2',
    left: 'right-full mr-2',
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
};

const tailPositionClasses: Record<HudMessageBubblePosition, string> = {
    right: 'left-0 top-1/2 -translate-y-1/2 -translate-x-full',
    left: 'right-0 top-1/2 -translate-y-1/2 translate-x-full',
    top: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-full',
    bottom: 'top-0 left-1/2 -translate-x-1/2 -translate-y-full',
};

const tailFillOffsetClasses: Record<HudMessageBubblePosition, string> = {
    right: 'left-[1px] top-1/2 -translate-y-1/2 -translate-x-full',
    left: 'right-[1px] top-1/2 -translate-y-1/2 translate-x-full',
    top: 'bottom-[1px] left-1/2 -translate-x-1/2 translate-y-full',
    bottom: 'top-[1px] left-1/2 -translate-x-1/2 -translate-y-full',
};

const tailBorderClasses: Record<
    HudMessageBubblePosition,
    Record<HudMessageBubbleVariant, string>
> = {
    right: {
        default: 'border-r-neutral-200 dark:border-r-neutral-700',
        green: 'border-r-green-200 dark:border-r-green-700',
    },
    left: {
        default: 'border-l-neutral-200 dark:border-l-neutral-700',
        green: 'border-l-green-200 dark:border-l-green-700',
    },
    top: {
        default: 'border-t-neutral-200 dark:border-t-neutral-700',
        green: 'border-t-green-200 dark:border-t-green-700',
    },
    bottom: {
        default: 'border-b-neutral-200 dark:border-b-neutral-700',
        green: 'border-b-green-200 dark:border-b-green-700',
    },
};

const tailFillClasses: Record<
    HudMessageBubblePosition,
    Record<HudMessageBubbleVariant, string>
> = {
    right: {
        default: 'border-r-white dark:border-r-neutral-900',
        green: 'border-r-white dark:border-r-green-900',
    },
    left: {
        default: 'border-l-white dark:border-l-neutral-900',
        green: 'border-l-white dark:border-l-green-900',
    },
    top: {
        default: 'border-t-white dark:border-t-neutral-900',
        green: 'border-t-white dark:border-t-green-900',
    },
    bottom: {
        default: 'border-b-white dark:border-b-neutral-900',
        green: 'border-b-white dark:border-b-green-900',
    },
};

const variantClasses: Record<HudMessageBubbleVariant, string> = {
    default:
        'bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800',
    green: 'bg-white dark:bg-green-900 text-green-800 dark:text-green-100 border-green-200 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-800',
};

export function HudMessageBubble({
    children,
    position = 'right',
    variant = 'default',
    onClick,
    className,
}: HudMessageBubbleProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cx(
                'absolute flex items-center whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium shadow-lg border transition-colors',
                positionClasses[position],
                variantClasses[variant],
                className,
            )}
        >
            {/* Speech bubble tail - border layer */}
            <div className={cx('absolute', tailPositionClasses[position])}>
                <div
                    className={cx(
                        'border-8 border-transparent',
                        tailBorderClasses[position][variant],
                    )}
                />
            </div>
            {/* Speech bubble tail - fill layer */}
            <div className={cx('absolute', tailFillOffsetClasses[position])}>
                <div
                    className={cx(
                        'border-8 border-transparent',
                        tailFillClasses[position][variant],
                    )}
                />
            </div>
            {children}
        </button>
    );
}
