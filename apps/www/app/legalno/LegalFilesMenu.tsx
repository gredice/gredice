'use client';

import { ListItem } from "@signalco/ui-primitives/ListItem";
import { KnownPages } from "../../src/KnownPages";
import { List } from "@signalco/ui-primitives/List";
import { useParams, usePathname } from "next/navigation";

export function LegalFilesMenu() {
    const pathname = usePathname();


    return (
        <List variant="outlined" className="bg-card">
            <ListItem
                selected={pathname === KnownPages.LegalPrivacy}
                href={KnownPages.LegalPrivacy}
                label={"Politika privatnosti"}
                variant="outlined" />
            <ListItem
                selected={pathname === KnownPages.LegalTerms}
                href={KnownPages.LegalTerms}
                label={"Uvjeti korištenja"}
                variant="outlined" />
            <ListItem
                selected={pathname === KnownPages.LegalCookies}
                href={KnownPages.LegalCookies}
                label={"Politika kolačića"}
                variant="outlined" />
        </List>
    );
}