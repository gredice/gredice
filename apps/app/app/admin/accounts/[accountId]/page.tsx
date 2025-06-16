import { Stack } from "@signalco/ui-primitives/Stack";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";
import { KnownPages } from "../../../../src/KnownPages";
import { auth } from "../../../../lib/auth/auth";
import { Field } from "../../../../components/shared/fields/Field";
import { AccountSunflowersCard } from "./AccountSunflowersCard";
import { Typography } from "@signalco/ui-primitives/Typography";
import { AccountGardensCard } from "./AccountGardensCard";
import { AccountUsersCard } from "./AccountUsersCard";
import { getAccountGardens } from "@gredice/storage";
import { Card, CardHeader, CardOverflow, CardTitle } from "@signalco/ui-primitives/Card";
import { Table } from "@signalco/ui-primitives/Table";
import { NoDataPlaceholder } from "../../../../components/shared/placeholders/NoDataPlaceholder";
import { LocaleDateTime } from "../../../../components/shared/LocaleDateTime";
import { AccountTransactionsCard } from "./AccountTransactionsCard";
import { NotificationCreateCard } from "../../../../components/NotificationCreateCard";

export const dynamic = 'force-dynamic';

export default async function AccountPage({ params }: { params: Promise<{ accountId: string; }> }) {
    const { accountId } = await params;
    await auth(['admin']);
    const gardens = await getAccountGardens(accountId);

    const raisedBeds = gardens.flatMap(garden => garden.raisedBeds);

    return (
        <Stack spacing={4}>
            <Stack spacing={2}>
                <Stack spacing={2}>
                    <Breadcrumbs items={[
                        { label: 'Računi', href: KnownPages.Accounts },
                        { label: accountId }
                    ]} />
                    <Typography level="h1" className="text-2xl" semiBold>Račun</Typography>
                </Stack>
                <Stack spacing={2}>
                    <Field name="ID računa" value={accountId} />
                </Stack>
            </Stack>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <AccountUsersCard accountId={accountId} />
                <AccountGardensCard accountId={accountId} />
                <AccountSunflowersCard accountId={accountId} />
                <AccountTransactionsCard accountId={accountId} />
                <Card>
                    <CardHeader>
                        <CardTitle>Podignute gredice</CardTitle>
                    </CardHeader>
                    <CardOverflow>
                        <Table>
                            <Table.Header>
                                <Table.Row>
                                    <Table.Head>ID</Table.Head>
                                    <Table.Head>Naziv</Table.Head>
                                    <Table.Head>Status</Table.Head>
                                    <Table.Head>Datum Kreiranja</Table.Head>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {raisedBeds.length === 0 && (
                                    <Table.Row>
                                        <Table.Cell colSpan={2}>
                                            <NoDataPlaceholder>
                                                Nema gredica
                                            </NoDataPlaceholder>
                                        </Table.Cell>
                                    </Table.Row>
                                )}
                                {raisedBeds.map(bed => (
                                    <Table.Row key={bed.id}>
                                        <Table.Cell>{bed.id}</Table.Cell>
                                        <Table.Cell>{bed.name}</Table.Cell>
                                        <Table.Cell>{bed.status}</Table.Cell>
                                        <Table.Cell><LocaleDateTime>{bed.createdAt}</LocaleDateTime></Table.Cell>
                                    </Table.Row>
                                ))}
                            </Table.Body>
                        </Table>
                    </CardOverflow>
                </Card>
                <NotificationCreateCard accountId={accountId} />
            </div>
        </Stack>
    );
}