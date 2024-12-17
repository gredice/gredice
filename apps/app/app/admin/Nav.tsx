import { List, ListHeader } from "@signalco/ui-primitives/List";
import { EntityTypesList } from "./EntityTypesList";
import { Home, Landmark } from "lucide-react";
import { KnownPages } from "../../src/KnownPages";
import { User } from "@signalco/ui-icons";
import { NavItem } from "./NavItem";
import { Stack } from "@signalco/ui-primitives/Stack";

export function Nav() {
    return (
        <Stack spacing={2}>
            <List>
                <NavItem href={KnownPages.Dashboard} label="Početna" icon={<Home className="size-5" />} />
            </List>
            <EntityTypesList />
            <Stack spacing={1}>
                <ListHeader header="Administracija" />
                <List>
                    <NavItem href={KnownPages.Users} label="Korisnici" icon={<User className="size-5" />} />
                    <NavItem href={KnownPages.Accounts} label="Računi" icon={<Landmark className="size-5" />} />
                </List>
            </Stack>
        </Stack>
    );
}