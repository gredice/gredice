'use client';

import { List } from "@signalco/ui-primitives/List";
import { ListItem } from "@signalco/ui-primitives/ListItem";
import Link from "next/link";
import { EntityTypesList } from "./EntityTypesList";
import { getEntityTypes } from "@gredice/storage";
import { Home, Landmark } from "lucide-react";
import { KnownPages } from "../../src/KnownPages";
import { usePathname } from "next/navigation";
import { User } from "@signalco/ui-icons";

export function MenuList({ entityTypes }: { entityTypes: Awaited<ReturnType<typeof getEntityTypes>> }) {
    const pathname = usePathname();
    return (
        <List>
            <Link href={KnownPages.Dashboard} passHref legacyBehavior>
                <ListItem
                    nodeId="dashboard"
                    selected={pathname === KnownPages.Dashboard}
                    onSelected={() => { }}
                    label="Početna"
                    startDecorator={<Home className="size-5" />} />
            </Link>
            <EntityTypesList entityTypes={entityTypes} />
            <Link href={KnownPages.Users} passHref legacyBehavior>
                <ListItem
                    nodeId="users"
                    selected={pathname === KnownPages.Users}
                    onSelected={() => { }}
                    label="Korisnici"
                    startDecorator={<User className="size-5" />} />
            </Link>
            <Link href={KnownPages.Accounts} passHref legacyBehavior>
                <ListItem
                    nodeId="accounts"
                    selected={pathname === KnownPages.Accounts}
                    onSelected={() => { }}
                    label="Računi"
                    startDecorator={<Landmark className="size-5" />} />
            </Link>
        </List>
    );
}