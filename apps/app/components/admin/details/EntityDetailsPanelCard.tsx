'use client';

import { Down } from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';
import type { ReactNode } from 'react';
import { useId, useState } from 'react';

export function EntityDetailsPanelCard({
    title,
    action,
    children,
}: {
    title: string;
    action?: ReactNode;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(true);
    const contentId = useId();

    return (
        <section className="min-w-0 overflow-hidden rounded-lg border bg-card shadow-md">
            <div className="flex shrink-0 items-center gap-1 px-3 py-2">
                <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={contentId}
                    onClick={() => setOpen((value) => !value)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left text-sm font-semibold text-foreground outline-hidden transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                    <Down
                        className={cx(
                            'size-3.5 shrink-0 text-muted-foreground transition-transform',
                            open ? '' : '-rotate-90',
                        )}
                        aria-hidden
                    />
                    <span className="min-w-0 truncate">{title}</span>
                </button>
                {action && <div className="-mr-1 shrink-0">{action}</div>}
            </div>
            <div id={contentId} hidden={!open} className="min-w-0 pb-2.5">
                {children}
            </div>
        </section>
    );
}
