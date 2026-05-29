'use client';

import { Add, Close } from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';
import { type ReactNode, useState } from 'react';

export function FaqAccordionItem({
    header,
    children,
    defaultOpen,
}: {
    header: string;
    children: ReactNode;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen ?? false);

    return (
        <div className={cx('border-b py-5', open && 'pb-5')}>
            <button
                type="button"
                className="flex w-full items-center gap-4 text-left"
                onClick={() => setOpen(!open)}
            >
                {open ? (
                    <Close className="size-5 shrink-0 text-primary" />
                ) : (
                    <Add className="size-5 shrink-0 text-primary" />
                )}
                <span className="font-semibold">{header}</span>
            </button>
            {open && (
                <div className="mt-4 pl-9 text-muted-foreground">
                    {children}
                </div>
            )}
        </div>
    );
}
