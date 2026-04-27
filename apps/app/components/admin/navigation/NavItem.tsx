'use client';

import { ListItem } from '@signalco/ui-primitives/ListItem';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { MouseEvent, ReactElement } from 'react';

export function NavItem({
    href,
    label,
    icon,
    strictMatch,
    onClick,
    isDragging = false,
    badge,
    compact = false,
}: {
    href: Route;
    label: string;
    icon: ReactElement;
    strictMatch?: boolean;
    onClick?: () => void;
    isDragging?: boolean;
    badge?: number;
    compact?: boolean;
}) {
    const pathname = usePathname();

    const handleClick = (e: MouseEvent) => {
        if (isDragging) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        if (onClick) {
            onClick();
        }
    };

    const listItemAccessibilityProps = compact ? { 'aria-label': label } : {};

    return (
        <Link href={href} onClick={handleClick} title={label}>
            <ListItem
                {...listItemAccessibilityProps}
                nodeId={href}
                selected={
                    strictMatch
                        ? pathname === href
                        : pathname === href || pathname.startsWith(`${href}/`)
                }
                onSelected={() => {}}
                label={compact ? '' : label}
                startDecorator={icon}
                endDecorator={
                    !compact && badge != null && badge > 0 ? (
                        <span className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium min-w-5 h-5 px-1.5">
                            {badge}
                        </span>
                    ) : undefined
                }
            />
        </Link>
    );
}
