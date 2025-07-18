import { List, ListHeader } from "@signalco/ui-primitives/List";
import { KnownPages } from "../../src/KnownPages";
import { Bank, Fence, Home, Inbox, SmileHappy, User, Tally3, Euro, Calendar, Hammer } from "@signalco/ui-icons";
import { NavItem } from "./NavItem";
import { Stack } from "@signalco/ui-primitives/Stack";
import { EntityTypeCreateModal } from "./EntityTypeCreateModal";
import { getEntityTypes } from "@gredice/storage";
import { ProfileNavItem } from "./ProfileNavItem";
import { File, ShoppingCart } from "@signalco/ui-icons";

export async function Nav() {
    const entityTypes = await getEntityTypes();

    return (
        <Stack spacing={2}>
            <List>
                <ProfileNavItem />
                <NavItem href={KnownPages.Dashboard} label="Početna" icon={<Home className="size-5" />} strictMatch />
            </List>
            <Stack spacing={1}>
                <ListHeader
                    header="Zapisi"
                    actions={[
                        <EntityTypeCreateModal key="modal" />
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
                    <NavItem href={KnownPages.Accounts} label="Računi" icon={<Bank className="size-5" />} />
                    <NavItem href={KnownPages.ShoppingCarts} label="Košarice" icon={<ShoppingCart className="size-5" />} />
                    <NavItem href={KnownPages.Transactions} label="Transakcije" icon={<Euro className="size-5" />} />
                    <NavItem href={KnownPages.Users} label="Korisnici" icon={<User className="size-5" />} />
                    <NavItem href={KnownPages.Gardens} label="Vrtovi" icon={<Fence className="size-5" />} />
                    <NavItem href={KnownPages.RaisedBeds} label="Gredice" icon={<Tally3 className="size-5 rotate-90 mt-1" />} />
                    <NavItem href={KnownPages.Operations} label="Radnje" icon={<Hammer className="size-5" />} />
                </List>
            </Stack>
            <Stack spacing={1}>
                <ListHeader header="Upravljanje" />
                <List>
                    <NavItem href={KnownPages.Schedule} label="Raspored" icon={<Calendar className="size-5" />} />
                </List>
            </Stack>
            <Stack spacing={1}>
                <ListHeader header="Komunikacija" />
                <List>
                    <NavItem href={KnownPages.CommunicationInbox} label="Sandučić" icon={<Inbox className="size-5" />} />
                    <NavItem href={KnownPages.Feedback} label="Povratne informacije" icon={<SmileHappy className="size-5" />} />
                </List>
            </Stack>
            <Stack spacing={1}>
                <ListHeader header="Sustavi" />
                <List>
                    <NavItem href={KnownPages.Sensors} label="Senzori" icon={<File className="size-5" />} />
                    <NavItem href={KnownPages.Cache} label="Cache" icon={<File className="size-5" />} />
                </List>
            </Stack>
        </Stack>
    );
}