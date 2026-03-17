'use client';

import { Info } from '@signalco/ui-icons';
import { cx } from '@signalco/ui-primitives/cx';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Popper } from '@signalco/ui-primitives/Popper';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { ReactNode } from 'react';

interface InfoHintProps {
    label: string;
    title?: string;
    children: ReactNode;
    className?: string;
}

export function InfoHint({ label, title, children, className }: InfoHintProps) {
    return (
        <Popper
            trigger={
                <IconButton title={label} variant="plain" className="size-8">
                    <Info className="size-4 shrink-0" />
                </IconButton>
            }
        >
            <div
                className={cx(
                    'max-w-sm space-y-2 rounded-md border bg-background p-3 shadow-2xl',
                    className,
                )}
            >
                {title && (
                    <Typography level="body2" bold>
                        {title}
                    </Typography>
                )}
                <div className="space-y-2 text-sm">{children}</div>
            </div>
        </Popper>
    );
}
