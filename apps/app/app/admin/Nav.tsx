import { List, ListHeader } from "@signalco/ui-primitives/List";
import { File, Home, Landmark } from "lucide-react";
import { KnownPages } from "../../src/KnownPages";
import { User } from "@signalco/ui-icons";
import { NavItem } from "./NavItem";
import { Stack } from "@signalco/ui-primitives/Stack";
import { EntityTypeCreateModal } from "./EntityTypeCreateModal";
import { getEntityTypes } from "@gredice/storage";

export async function Nav() {
    const entityTypes = await getEntityTypes();

    return (
        <Stack spacing={2}>
            <List>
                <NavItem href={KnownPages.Dashboard} label="Početna" icon={<Home className="size-5" />} strictMatch />
            </List>
            <Stack spacing={1}>
                <ListHeader
                    header="Zapisi"
                    actions={[
                        <EntityTypeCreateModal />
                    ]}
                />
                <List>
                    {entityTypes.map(entityType => (
                        <NavItem
                            key={entityType.id}
                            href={KnownPages.DirectoryEntityType(entityType.name)}
                            label={entityType.label}
                            icon={<File className="size-5" />}
                        />
                    ))}
                </List>
            </Stack>
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