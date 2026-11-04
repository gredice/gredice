'use client';

import { Button } from '@gredice/ui/Button';
import { Down, Up } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { cx } from '@gredice/ui/utils';
import { useEffect, useRef, useState } from 'react';

export type ExpandableTextProps = {
    children: React.ReactNode;
    maxHeight?: number;
    className?: string;
    expandButtonText?: string;
    collapseButtonText?: string;
};

/**
 * Collapses long text on phones only; from `md` up the full text shows.
 * The fade is a mask on the text itself, so it works over any page
 * background (the public sky included), and nothing collapses when the
 * text already fits.
 */
export function ExpandableText({
    children,
    maxHeight = 200,
    className,
    expandButtonText = 'Prikaži više',
    collapseButtonText = 'Prikaži manje',
}: ExpandableTextProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isOverflowing, setIsOverflowing] = useState(true);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const content = contentRef.current;
        if (!content) {
            return;
        }

        const update = () =>
            setIsOverflowing(
                content.getBoundingClientRect().height > maxHeight + 1,
            );
        update();
        const observer = new ResizeObserver(update);
        observer.observe(content);
        return () => observer.disconnect();
    }, [maxHeight]);

    const isCollapsed = isOverflowing && !isExpanded;

    return (
        <Stack className={cx('relative', className)}>
            <div
                className={cx(
                    'overflow-hidden md:max-h-none! md:[mask-image:none]',
                    isCollapsed &&
                        '[mask-image:linear-gradient(to_bottom,#000_55%,transparent)]',
                )}
                style={{ maxHeight: isCollapsed ? maxHeight : undefined }}
            >
                <div ref={contentRef}>{children}</div>
            </div>
            {isOverflowing ? (
                <Button
                    variant="link"
                    size="sm"
                    aria-expanded={isExpanded}
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="self-center md:hidden"
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
            ) : null}
        </Stack>
    );
}
