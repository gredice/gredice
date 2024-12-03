import { getAccounts, getEntitiesRaw, getEntityTypes, getUsers } from "@gredice/storage";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { Divider } from "@signalco/ui-primitives/Divider";
import { Row } from "@signalco/ui-primitives/Row";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { PropsWithChildren } from "react";
import { KnownPages } from "../../src/KnownPages";

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
        <Row spacing={2}>
            <Typography level="body3" className="min-w-fit">{children}</Typography>
            <Divider />
        </Row>
    );
}

export default async function AdminPage() {
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
                </div>
            </Stack>
        </Stack>
    );
}