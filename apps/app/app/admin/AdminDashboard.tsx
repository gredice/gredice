import { getAnalyticsTotals, getEntitiesRaw, getEntityTypes } from "@gredice/storage";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { PropsWithChildren } from "react";
import { KnownPages } from "../../src/KnownPages";
import { auth } from "../../lib/auth/auth";
import { Row } from "@signalco/ui-primitives/Row";
import { cx } from "@signalco/ui-primitives/cx";

function FactCard({ header, value, href, beforeValue }: { header: string, value: string | number, href?: string, beforeValue?: string | number }) {
    const isNumber = typeof beforeValue === 'number' && typeof value === 'number';
    const diff = isNumber ? (value - beforeValue) : undefined;
    const isPositive = isNumber && diff !== undefined && diff > 0;
    const isNegative = isNumber && diff !== undefined && diff < 0;
    return (
        <Card href={href}>
            <CardOverflow className="p-4">
                <Stack spacing={1}>
                    <Typography level="body2">{header}</Typography>
                    <Row justifyContent="space-between">
                        <Typography level="h3">{value}</Typography>
                        {(isPositive || isNegative) && beforeValue !== undefined && (
                            <Typography
                                level="h5"
                                component="span"
                                semiBold
                                className={cx(
                                    "text-muted-foreground text-right self-end",
                                    isPositive && "text-green-600 dark:text-green-500",
                                    isNegative && "text-red-600 dark:text-red-500",
                                )}>
                                {isNumber ? `${(diff ?? 0) > 0 ? '+' : ''}${diff}` : beforeValue}
                            </Typography>
                        )}
                    </Row>
                </Stack>
            </CardOverflow>
        </Card>
    )
}

function DashboardDivider({ children }: PropsWithChildren) {
    return (
        <div className="relative text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
            <span className="relative z-10 bg-background px-2 text-muted-foreground">
                {children}
            </span>
        </div>
    );
}

export async function AdminDashboard() {
    await auth(['admin']);
    const entityTypes = await getEntityTypes();
    const entitiesCounts = await Promise.all(entityTypes.map(async entityType => {
        const entities = await getEntitiesRaw(entityType.name);
        return {
            entityTypeName: entityType.name,
            label: entityType.label,
            count: entities.length
        };
    }));
    const {
        users: usersCount,
        usersBefore: usersBeforeCount,
        accounts: accountsCount,
        accountsBefore: accountsBeforeCount,
        gardens: gardensCount,
        gardensBefore: gardensBeforeCount,
        blocks: blocksCount,
        blocksBefore: blocksBeforeCount,
        events: eventsCount,
        eventsBefore: eventsBeforeCount,
        farms: farmsCount,
        farmsBefore: farmsBeforeCount,
        raisedBeds: raisedBedsCount,
        raisedBedsBefore: raisedBedsBeforeCount,
        transactions: transactionsCount,
        transactionsBefore: transactionsBeforeCount
    } = await getAnalyticsTotals();

    return (
        <Stack spacing={1}>
            <Stack spacing={1}>
                <DashboardDivider>Računi i korisnici</DashboardDivider>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <FactCard header="Računi" value={accountsCount} href={KnownPages.Accounts} beforeValue={accountsBeforeCount} />
                    <FactCard header="Korisnici" value={usersCount} href={KnownPages.Users} beforeValue={usersBeforeCount} />
                    <FactCard header="Farme" value={farmsCount} beforeValue={farmsBeforeCount} />
                    <FactCard header="Vrtovi" value={gardensCount} href={KnownPages.Gardens} beforeValue={gardensBeforeCount} />
                    <FactCard header="Blokovi" value={blocksCount} beforeValue={blocksBeforeCount} />
                    <FactCard header="Događaji" value={eventsCount} beforeValue={eventsBeforeCount} />
                    <FactCard header="Gredice" value={raisedBedsCount} href={KnownPages.RaisedBeds} beforeValue={raisedBedsBeforeCount} />
                    <FactCard header="Transakcije" value={transactionsCount} href={KnownPages.Transactions} beforeValue={transactionsBeforeCount} />
                </div>
            </Stack>
            <Stack spacing={1}>
                <DashboardDivider>Zapisi</DashboardDivider>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {entitiesCounts.map(({ label, count, entityTypeName }) => (
                        <FactCard key={entityTypeName} header={label} value={count} href={KnownPages.DirectoryEntityType(entityTypeName)} />
                    ))}
                </div>
            </Stack>
        </Stack>
    );
}
