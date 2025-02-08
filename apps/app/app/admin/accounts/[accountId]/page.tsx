import { Card, CardContent, CardHeader, CardOverflow, CardTitle } from "@signalco/ui-primitives/Card";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";
import { getAccountGardens, getAccountUsers } from "@gredice/storage";
import Link from "next/link";
import { KnownPages } from "../../../../src/KnownPages";
import { Table } from "@signalco/ui-primitives/Table";
import { NoDataPlaceholder } from "../../../../components/shared/placeholders/NoDataPlaceholder";
import { auth } from "../../../../lib/auth/auth";
import { Field } from "../../../../components/shared/fields/Field";

async function AccountUsersCard({ accountId }: { accountId: string }) {
    const users = await getAccountUsers(accountId);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Korisnici</CardTitle>
            </CardHeader>
            <CardOverflow>
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.Head>Korisnicko ime</Table.Head>
                            <Table.Head>Datum povezivanja</Table.Head>
                            <Table.Head>Datum ažuriranja veze</Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {users.length === 0 && (
                            <Table.Row>
                                <Table.Cell colSpan={3}>
                                    <NoDataPlaceholder>
                                        Nema povezanih korisnika
                                    </NoDataPlaceholder>
                                </Table.Cell>
                            </Table.Row>
                        )}
                        {users.map(user => (
                            <Table.Row key={user.id}>
                                <Table.Cell>
                                    <Link href={KnownPages.User(user.user.id)}>
                                        {user.user.userName}
                                    </Link>
                                </Table.Cell>
                                <Table.Cell>
                                    {user.createdAt.toLocaleString('hr-HR')}
                                </Table.Cell>
                                <Table.Cell>
                                    {user.updatedAt.toLocaleString('hr-HR')}
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            </CardOverflow>
        </Card>
    );
}

async function AccountGardensCard({ accountId }: { accountId: string }) {
    const gardens = await getAccountGardens(accountId);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Vrtovi</CardTitle>
            </CardHeader>
            <CardOverflow>
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.Head>Naziv</Table.Head>
                            <Table.Head>Datum kreiranja</Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {gardens.length === 0 && (
                            <Table.Row>
                                <Table.Cell colSpan={3}>
                                    <NoDataPlaceholder>
                                        Nema povezanih vrtova
                                    </NoDataPlaceholder>
                                </Table.Cell>
                            </Table.Row>
                        )}
                        {gardens.map(garden => (
                            <Table.Row key={garden.id}>
                                <Table.Cell>
                                    <Link href={KnownPages.Garden(garden.id)}>
                                        {garden.name}
                                    </Link>
                                </Table.Cell>
                                <Table.Cell title={garden.createdAt.toISOString()}>{garden.createdAt.toLocaleDateString()}</Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            </CardOverflow>
        </Card>
    );
}

export default async function AccountPage({ params }: { params: Promise<{ accountId: string; }> }) {
    const { accountId } = await params;
    await auth(['admin']);

    return (
        <Stack spacing={2}>
            <Card>
                <CardHeader>
                    <Stack spacing={2}>
                        <Breadcrumbs items={[
                            { label: 'Računi', href: KnownPages.Accounts },
                            { label: accountId }
                        ]} />
                        <CardTitle>Račun</CardTitle>
                    </Stack>
                </CardHeader>
                <CardContent>
                    <Stack spacing={2}>
                        <Field name="ID računa" value={accountId} />
                    </Stack>
                </CardContent>
            </Card>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <AccountUsersCard accountId={accountId} />
                <AccountGardensCard accountId={accountId} />
            </div>
        </Stack>
    );
}