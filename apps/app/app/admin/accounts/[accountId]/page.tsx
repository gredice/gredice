import { Card, CardContent, CardHeader, CardOverflow, CardTitle } from "@signalco/ui-primitives/Card";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";
import { getAccountUsers } from "@gredice/storage";
import { Typography } from "@signalco/ui-primitives/Typography";
import Link from "next/link";
import { KnownPages } from "../../../../src/KnownPages";
import { Table } from "@signalco/ui-primitives/Table";
import { NoDataPlaceholder } from "../../../../components/shared/placeholders/NoDataPlaceholder";
import { auth } from "../../../../lib/auth/auth";

export default async function AccountPage({ params }: { params: Promise<{ accountId: string; }> }) {
    const { accountId } = await params;
    await auth(['admin']);
    const users = await getAccountUsers(accountId);

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
                        <Stack>
                            <Typography level="body2" semiBold>ID računa</Typography>
                            <Typography level="body1">
                                {accountId}
                            </Typography>
                        </Stack>
                    </Stack>
                </CardContent>
            </Card>
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
        </Stack>
    );
}