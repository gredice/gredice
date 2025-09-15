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
}: {
    href: Route;
    label: string;
    icon: ReactElement;
    strictMatch?: boolean;
    onClick?: () => void;
    isDragging?: boolean;
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

    return (
        <Link href={href} onClick={handleClick}>
            <ListItem
                nodeId={href}
                selected={
                    strictMatch
                        ? pathname === href
                        : pathname === href || pathname.startsWith(`${href}/`)
                }
                onSelected={() => {}}
                label={label}
                startDecorator={icon}
            />
        </Link>
    );
}
