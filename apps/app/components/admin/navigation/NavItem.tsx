'use client';

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
    nested = false,
}: {
    href: Route;
    label: string;
    icon: ReactElement;
    strictMatch?: boolean;
    onClick?: () => void;
    isDragging?: boolean;
    badge?: number;
    compact?: boolean;
    nested?: boolean;
}) {
    const pathname = usePathname();
    const selected = strictMatch
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`);

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

    const guideLineClassName =
        compact || !nested
            ? ''
            : "before:absolute before:-left-3 before:top-1/2 before:h-px before:w-3 before:bg-border/55 before:content-['']";
    const itemClassName = [
        'group/nav-item relative flex w-full items-center gap-2 rounded-md text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        compact ? 'h-9 justify-center px-0' : 'h-8 px-2',
        guideLineClassName,
        selected
            ? 'bg-muted text-foreground shadow-sm ring-1 ring-border/40'
            : 'text-foreground hover:bg-muted/70',
    ].join(' ');
    const iconClassName = 'flex size-6 shrink-0 items-center justify-center';

    return (
        <Link
            href={href}
            onClick={handleClick}
            title={label}
            aria-label={compact ? label : undefined}
            aria-current={selected ? 'page' : undefined}
            className={itemClassName}
        >
            <span className={iconClassName}>{icon}</span>
            {!compact && (
                <span className="min-w-0 flex-1 truncate">{label}</span>
            )}
            {!compact && badge != null && badge > 0 ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-primary-foreground text-xs font-medium">
                    {badge}
                </span>
            ) : null}
            {compact && badge != null && badge > 0 ? (
                <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-background" />
            ) : null}
        </Link>
    );
}
