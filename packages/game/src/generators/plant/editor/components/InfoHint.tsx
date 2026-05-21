'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { Info } from '@gredice/ui/icons';
import { Popper } from '@gredice/ui/Popper';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
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
