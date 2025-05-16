'use client';

import { ListItem } from "@signalco/ui-primitives/ListItem";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactElement } from "react";

export function NavItem({ href, label, icon, strictMatch }: { href: string, label: string, icon: ReactElement, strictMatch?: boolean }) {
    const pathname = usePathname();
    return (
        <Link href={href}>
            <ListItem
                nodeId={href}
                selected={strictMatch ? pathname === href : pathname === href || pathname.startsWith(href + '/')}
                onSelected={() => { }}
                label={label}
                startDecorator={icon} />
        </Link>
    );
}