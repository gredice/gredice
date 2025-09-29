'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { cx } from '@signalco/ui-primitives/cx';
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
        <div className={cx('relative', className)}>
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
                    <div
                        className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none"
                        style={{
                            background:
                                'linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)',
                        }}
                    />
                )}
            </div>
            <Button
                variant="plain"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-2 text-sm text-muted-foreground hover:text-foreground"
            >
                {isExpanded ? (
                    <>
                        <span className="mr-1">↑</span>
                        {collapseButtonText}
                    </>
                ) : (
                    <>
                        <span className="mr-1">↓</span>
                        {expandButtonText}
                    </>
                )}
            </Button>
        </div>
    );
}
