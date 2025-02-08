import { Card, CardContent, CardHeader, CardOverflow, CardTitle } from "@signalco/ui-primitives/Card";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";
import { getUser, getUserWithLogins } from "@gredice/storage";
import { Typography } from "@signalco/ui-primitives/Typography";
import { KnownPages } from "../../../../src/KnownPages";
import { notFound } from "next/navigation";
import { Table } from "@signalco/ui-primitives/Table";
import Link from "next/link";
import { SelectUserRole } from "../SelectUserRole";
import { Row } from "@signalco/ui-primitives/Row";
import { ButtonImpersonateUser } from "../ButtonImpersonateUser";
import { Disabled, Warning } from "@signalco/ui-icons";
import { NoDataPlaceholder } from "../../../../components/shared/placeholders/NoDataPlaceholder";
import { auth } from "../../../../lib/auth/auth";
import { FieldSet } from "../../../../components/shared/fields/FieldSet";
import { Field } from "../../../../components/shared/fields/Field";

export default async function UserPage({ params }: { params: Promise<{ userId: string; }> }) {
    const { userId } = await params;
    await auth(['admin']);
    const user = await getUser(userId);
    if (!user) {
        return notFound();
    }

    const logins = await getUserWithLogins(user.userName);

    const {
        id,
        createdAt,
        updatedAt,
        userName,
        accounts
    } = user;

    return (
        <Stack spacing={2}>
            <Card>
                <CardHeader>
                    <Stack spacing={2}>
                        <Breadcrumbs items={[
                            { label: 'Korisnici', href: KnownPages.Users },
                            { label: user.userName }
                        ]} />
                        <Row justifyContent="space-between">
                            <CardTitle>Korisnik {user.userName}</CardTitle>
                            <ButtonImpersonateUser userId={user.id} />
                        </Row>
                    </Stack>
                </CardHeader>
                <CardContent>
                    <Stack spacing={2}>
                        <FieldSet>
                            <Field name="ID korisnika" value={id} mono />
                            <Field name="Korisničko ime" value={userName} />
                            <Field name="Uloga" value={<SelectUserRole user={user} />} />
                        </FieldSet>
                        <FieldSet>
                            <Field name="Datum kreiranja" value={createdAt.toLocaleString('hr-HR')} />
                            <Field name="Datum ažuriranja" value={updatedAt.toLocaleString('hr-HR')} />
                        </FieldSet>
                    </Stack>
                </CardContent>
            </Card>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Računi</CardTitle>
                    </CardHeader>
                    <CardOverflow>
                        <Table>
                            <Table.Header>
                                <Table.Row>
                                    <Table.Head>ID</Table.Head>
                                    <Table.Head>Datum povezivanja</Table.Head>
                                    <Table.Head>Datum ažuriranja veze</Table.Head>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {accounts.length === 0 && (
                                    <Table.Row>
                                        <Table.Cell colSpan={3}>
                                            <NoDataPlaceholder>
                                                Nema povezanih računa
                                            </NoDataPlaceholder>
                                        </Table.Cell>
                                    </Table.Row>
                                )}
                                {accounts.map(account => (
                                    <Table.Row key={account.id}>
                                        <Table.Cell>
                                            <Link href={KnownPages.Account(account.account.id)}>
                                                <Typography mono>
                                                    {account.account.id}
                                                </Typography>
                                            </Link>
                                        </Table.Cell>
                                        <Table.Cell>
                                            {account.createdAt.toLocaleString('hr-HR')}
                                        </Table.Cell>
                                        <Table.Cell>
                                            {account.updatedAt.toLocaleString('hr-HR')}
                                        </Table.Cell>
                                    </Table.Row>
                                ))}
                            </Table.Body>
                        </Table>
                    </CardOverflow>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Načini prijave</CardTitle>
                    </CardHeader>
                    <CardOverflow>
                        <Table>
                            <Table.Header>
                                <Table.Row>
                                    <Table.Head>Vrsta</Table.Head>
                                    <Table.Head>Blokiran</Table.Head>
                                    <Table.Head>Datum kreiranja</Table.Head>
                                    <Table.Head>Datum ažuriranja</Table.Head>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {logins?.usersLogins.length === 0 && (
                                    <Table.Row>
                                        <Table.Cell colSpan={3}>
                                            <NoDataPlaceholder>
                                                Nema načina prijave
                                            </NoDataPlaceholder>
                                        </Table.Cell>
                                    </Table.Row>
                                )}
                                {logins?.usersLogins.map(userLogin => (
                                    <Table.Row key={user.id}>
                                        <Table.Cell>
                                            <Link href={KnownPages.User(user.id)}>
                                                {userLogin.loginType}
                                            </Link>
                                        </Table.Cell>
                                        <Table.Cell>
                                            {userLogin.blockedUntil && userLogin.blockedUntil > new Date()
                                                ? (
                                                    <Row spacing={1}>
                                                        <Disabled className="text-red-500" />
                                                        <Typography>
                                                            {'Blokiran do ' + userLogin.blockedUntil.toLocaleString('hr-HR')}
                                                        </Typography>
                                                    </Row>
                                                ) : userLogin.failedAttempts > 0 ? (
                                                    <Row spacing={1}>
                                                        <Warning className="text-amber-500" />
                                                        <Stack>
                                                            <Typography>
                                                                {userLogin.failedAttempts + ' neuspjelih pokušaja'}
                                                            </Typography>
                                                            <Typography>
                                                                {'Zadnji ' + userLogin.lastFailedAttempt?.toLocaleString('hr-HR')}
                                                            </Typography>
                                                        </Stack>
                                                    </Row>
                                                ) : 'Ne'}
                                        </Table.Cell>
                                        <Table.Cell>
                                            {userLogin.createdAt.toLocaleString('hr-HR')}
                                        </Table.Cell>
                                        <Table.Cell>
                                            {userLogin.updatedAt.toLocaleString('hr-HR')}
                                        </Table.Cell>
                                    </Table.Row>
                                ))}
                            </Table.Body>
                        </Table>
                    </CardOverflow>
                </Card>
            </div>
        </Stack>
    );
}