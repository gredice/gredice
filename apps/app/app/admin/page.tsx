import { getAccounts, getEntitiesRaw, getEntityTypes, getGardens, getUsers } from "@gredice/storage";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { PropsWithChildren } from "react";
import { KnownPages } from "../../src/KnownPages";
import { auth } from "../../lib/auth/auth";

export const dynamic = 'force-dynamic';

function FactCard({ header, value, href }: { header: string, value: string | number, href?: string }) {
    return (
        <Card href={href}>
            <CardOverflow className="p-4">
                <Stack spacing={1}>
                    <Typography level="body2">{header}</Typography>
                    <Typography level="h3">{value}</Typography>
                </Stack>
            </CardOverflow>
        </Card>
    )
}

function DashboardDivider({ children }: PropsWithChildren) {
    return (
        <div className="relative text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
            <span className="relative z-10 bg-muted px-2 text-muted-foreground">
                {children}
            </span>
        </div>
    );
}

async function Dashboard() {
    const entityTypes = await getEntityTypes();
    const entitiesCounts = await Promise.all(entityTypes.map(async entityType => {
        const entities = await getEntitiesRaw(entityType.name);
        return {
            entityTypeName: entityType.name,
            label: entityType.label,
            count: entities.length
        };
    }));
    const users = await getUsers();
    const usersCount = users.length;
    const accounts = await getAccounts();
    const accountsCount = accounts.length;
    const gardens = await getGardens();
    const gardensCount = gardens.length

    return (
        <Stack spacing={1}>
            <Stack spacing={1}>
                <DashboardDivider>Zapisi</DashboardDivider>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {entitiesCounts.map(({ label, count, entityTypeName }) => (
                        <FactCard key={entityTypeName} header={label} value={count} href={KnownPages.DirectoryEntityType(entityTypeName)} />
                    ))}
                </div>
            </Stack>
            <Stack spacing={1}>
                <DashboardDivider>Računi i korisnici</DashboardDivider>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <FactCard header="Korisnici" value={usersCount} href={KnownPages.Users} />
                    <FactCard header="Računi" value={accountsCount} href={KnownPages.Accounts} />
                    <FactCard header="Vrtovi" value={gardensCount} href={KnownPages.Gardens} />
                </div>
            </Stack>
        </Stack>
    );
}

export default async function AdminPage() {
    await auth(['admin']);

    return (
        <Dashboard />
    );
}