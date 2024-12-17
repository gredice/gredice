'use client';

import { ListItem } from "@signalco/ui-primitives/ListItem";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactElement } from "react";

export function NavItem({ href, label, icon }: { href: string, label: string, icon: ReactElement }) {
    const pathname = usePathname();
    return (
        <Link href={href} passHref legacyBehavior>
            <ListItem
                nodeId={href}
                selected={pathname === href}
                onSelected={() => { }}
                label={label}
                startDecorator={icon} />
        </Link>
    );
}