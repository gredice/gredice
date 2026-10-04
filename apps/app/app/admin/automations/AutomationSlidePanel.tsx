'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { Close } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import type { ReactNode } from 'react';

type AutomationSlidePanelProps = {
    children: ReactNode;
    open: boolean;
    title: string;
    description?: string;
    widthClassName?: string;
    onOpenChange(open: boolean): void;
};

export function AutomationSlidePanel({
    children,
    description,
    onOpenChange,
    open,
    title,
    widthClassName,
}: AutomationSlidePanelProps) {
    return (
        <>
            <button
                type="button"
                aria-label="Zatvori panel"
                aria-hidden={!open || undefined}
                className={cx(
                    'fixed inset-0 z-40 bg-black/20 opacity-0 transition-opacity duration-200',
                    open
                        ? 'pointer-events-auto opacity-100'
                        : 'pointer-events-none',
                )}
                onClick={() => onOpenChange(false)}
                tabIndex={open ? 0 : -1}
            />
            <aside
                aria-hidden={!open || undefined}
                className={cx(
                    'fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] translate-x-full flex-col border-l bg-background shadow-xl transition-transform duration-300 ease-out motion-reduce:transition-none',
                    open
                        ? 'pointer-events-auto translate-x-0'
                        : 'pointer-events-none',
                    widthClassName,
                )}
                inert={!open || undefined}
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4">
                    <Stack spacing={1} className="min-w-0">
                        <Typography level="h5" component="h2">
                            {title}
                        </Typography>
                        {description ? (
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                {description}
                            </Typography>
                        ) : null}
                    </Stack>
                    <IconButton
                        type="button"
                        size="sm"
                        variant="plain"
                        aria-label="Zatvori panel"
                        onClick={() => onOpenChange(false)}
                    >
                        <Close className="size-4" />
                    </IconButton>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    {children}
                </div>
            </aside>
        </>
    );
}
