'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';
import { useControllableState } from '../hooks/useControllableState';
import { Down } from '../icons';
import { cx } from '../utils';

export type PanelSectionProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
    title: ReactNode;
    action?: ReactNode;
    contentClassName?: string;
    defaultOpen?: boolean;
    density?: 'default' | 'compact';
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    unmountOnExit?: boolean;
    variant?: 'card' | 'plain';
};

export function PanelSection({
    action,
    children,
    className,
    contentClassName,
    defaultOpen = true,
    density = 'default',
    open,
    onOpenChange,
    title,
    unmountOnExit,
    variant = 'card',
    ...props
}: PanelSectionProps) {
    const contentId = useId();
    const [openState, setOpenState] = useControllableState(
        open,
        defaultOpen,
        onOpenChange,
    );
    const isOpen = openState ?? true;
    const shouldRenderContent = isOpen || !unmountOnExit;

    return (
        <section
            className={cx(
                'min-w-0 overflow-hidden',
                variant === 'card'
                    ? 'rounded-lg border bg-card shadow-md'
                    : 'bg-transparent',
                className,
            )}
            {...props}
        >
            <div
                className={cx(
                    'flex shrink-0 items-center gap-1',
                    variant === 'card' ? 'px-3' : 'px-0',
                    density === 'compact' ? 'py-1' : 'py-2',
                )}
            >
                <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={contentId}
                    onClick={() => setOpenState(!isOpen)}
                    className={cx(
                        'flex min-w-0 flex-1 items-center rounded-md px-1 text-left font-semibold text-foreground outline-hidden transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        density === 'compact'
                            ? 'gap-1.5 py-0.5 text-xs'
                            : 'gap-2 py-1 text-sm',
                    )}
                >
                    <Down
                        className={cx(
                            'shrink-0 text-muted-foreground transition-transform',
                            density === 'compact' ? 'size-3' : 'size-3.5',
                            isOpen ? '' : '-rotate-90',
                        )}
                        aria-hidden
                    />
                    <span className="min-w-0 truncate">{title}</span>
                </button>
                {action ? <div className="-mr-1 shrink-0">{action}</div> : null}
            </div>
            {shouldRenderContent ? (
                <div
                    id={contentId}
                    hidden={!isOpen}
                    className={cx(
                        'min-w-0',
                        density === 'compact' ? 'pb-1.5' : 'pb-2.5',
                        contentClassName,
                    )}
                >
                    {children}
                </div>
            ) : null}
        </section>
    );
}
