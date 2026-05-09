'use client';

import { Down, Up } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { cx } from '@signalco/ui-primitives/cx';
import { Stack } from '@signalco/ui-primitives/Stack';
import { useState } from 'react';

export type ExpandableTextProps = {
    children: React.ReactNode;
    maxHeight?: number;
    className?: string;
    expandButtonText?: string;
    collapseButtonText?: string;
};

export function ExpandableText({
    children,
    maxHeight = 200,
    className,
    expandButtonText = 'Prikaži više',
    collapseButtonText = 'Prikaži manje',
}: ExpandableTextProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <Stack className={cx('relative', className)}>
            <div
                className={cx(
                    'overflow-hidden transition-all duration-300 ease-in-out',
                    !isExpanded && 'relative',
                )}
                style={{
                    maxHeight: isExpanded ? 'none' : `${maxHeight}px`,
                }}
            >
                {children}
                {!isExpanded && (
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none" />
                )}
            </div>
            <Button
                variant="link"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="self-center"
                startDecorator={
                    isExpanded ? (
                        <Up className="size-4 shrink-0" />
                    ) : (
                        <Down className="size-4 shrink-0" />
                    )
                }
            >
                {isExpanded ? collapseButtonText : expandButtonText}
            </Button>
        </Stack>
    );
}
