'use client';

import { ListItem } from '@signalco/ui-primitives/ListItem';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactElement } from 'react';

export function NavItem({
    href,
    label,
    icon,
    strictMatch,
    onClick,
}: {
    href: string;
    label: string;
    icon: ReactElement;
    strictMatch?: boolean;
    onClick?: () => void;
}) {
    const pathname = usePathname();
    return (
        <Link href={href}>
            <ListItem
                nodeId={href}
                selected={
                    strictMatch
                        ? pathname === href
                        : pathname === href || pathname.startsWith(`${href}/`)
                }
                onSelected={onClick ? () => onClick() : () => {}}
                label={label}
                startDecorator={icon}
            />
        </Link>
    );
}
