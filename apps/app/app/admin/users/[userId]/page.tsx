import { Card, CardHeader, CardOverflow, CardTitle } from "@signalco/ui-primitives/Card";
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
import { LocaleDateTime } from "../../../../components/shared/LocaleDateTime";

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
        <Stack spacing={4}>
            <Stack spacing={2}>
                <Row spacing={2} justifyContent="space-between">
                    <Breadcrumbs items={[
                        { label: 'Korisnici', href: KnownPages.Users },
                        { label: user.userName }
                    ]} />
                    <ButtonImpersonateUser userId={user.id} />
                </Row>
                <Stack spacing={2}>
                    <FieldSet>
                        <Field name="ID korisnika" value={id} mono />
                        <Field name="Korisničko ime" value={userName} />
                        <Field name="Uloga" value={<SelectUserRole user={user} />} />
                    </FieldSet>
                    <FieldSet>
                        <Field name="Datum kreiranja" value={<LocaleDateTime>{createdAt}</LocaleDateTime>} />
                        <Field name="Datum ažuriranja" value={<LocaleDateTime>{updatedAt}</LocaleDateTime>} />
                    </FieldSet>
                </Stack>
            </Stack>
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
                                            <LocaleDateTime>{account.createdAt}</LocaleDateTime>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <LocaleDateTime>{account.updatedAt}</LocaleDateTime>
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
                                    <Table.Head>Zadnja prijava</Table.Head>
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
                                    <Table.Row key={userLogin.id}>
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
                                                            {'Blokiran do '}
                                                            <LocaleDateTime>{userLogin.blockedUntil}</LocaleDateTime>
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
                                                                {'Zadnji '}
                                                                <LocaleDateTime>{userLogin.lastFailedAttempt}</LocaleDateTime>
                                                            </Typography>
                                                        </Stack>
                                                    </Row>
                                                ) : 'Ne'}
                                        </Table.Cell>
                                        <Table.Cell>
                                            {userLogin.lastLogin ? (
                                                <LocaleDateTime>
                                                    {userLogin.lastLogin}
                                                </LocaleDateTime>
                                            ) : 'Nikad'}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <LocaleDateTime>
                                                {userLogin.createdAt}
                                            </LocaleDateTime>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <LocaleDateTime>
                                                {userLogin.updatedAt}
                                            </LocaleDateTime>
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