'use client';

import { List } from "@signalco/ui-primitives/List";
import { ListItem } from "@signalco/ui-primitives/ListItem";
import Link from "next/link";
import { EntityTypesList } from "./EntityTypesList";
import { getEntityTypes } from "@gredice/storage";
import { Home } from "lucide-react";
import { KnownPages } from "../../src/KnownPages";
import { usePathname } from "next/navigation";

export function MenuList({ entityTypes }: { entityTypes: Awaited<ReturnType<typeof getEntityTypes>> }) {
    const pathname = usePathname();
    const isDashboardSelected = pathname === KnownPages.Dashboard;

    return (
        <List>
            <Link href={KnownPages.Dashboard} passHref legacyBehavior>
                <ListItem
                    nodeId="dashboard"
                    selected={isDashboardSelected}
                    onSelected={() => { }}
                    label="Početna"
                    startDecorator={<Home className="size-5" />} />
            </Link>
            <EntityTypesList entityTypes={entityTypes} />
        </List>
    );
}