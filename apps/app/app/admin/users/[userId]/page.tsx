import { getUser, getUserWithLogins } from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Check, Disabled, Warning } from '@signalco/ui-icons';
import {
    Card,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Field } from '../../../../components/shared/fields/Field';
import { FieldSet } from '../../../../components/shared/fields/FieldSet';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { ServerActionIconButton } from '../../../../components/shared/ServerActionIconButton';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import { unblockUserLogin } from '../../../(actions)/userActions';
import { ButtonImpersonateUser } from '../ButtonImpersonateUser';
import { SelectUserRole } from '../SelectUserRole';

export default async function UserPage({
    params,
}: {
    params: Promise<{ userId: string }>;
}) {
    const { userId } = await params;
    await auth(['admin']);
    const user = await getUser(userId);
    if (!user) {
        return notFound();
    }

    const logins = await getUserWithLogins(user.userName);

    const { id, createdAt, updatedAt, userName, accounts } = user;

    return (
        <Stack spacing={4}>
            <Stack spacing={2}>
                <Row spacing={2} justifyContent="space-between">
                    <Breadcrumbs
                        items={[
                            { label: 'Korisnici', href: KnownPages.Users },
                            { label: user.userName },
                        ]}
                    />
                    <ButtonImpersonateUser userId={user.id} />
                </Row>
                <Stack spacing={2}>
                    <FieldSet>
                        <Field name="ID korisnika" value={id} mono />
                        <Field name="Korisničko ime" value={userName} />
                        <Field
                            name="Uloga"
                            value={<SelectUserRole user={user} />}
                        />
                    </FieldSet>
                    <FieldSet>
                        <Field
                            name="Datum kreiranja"
                            value={<LocalDateTime>{createdAt}</LocalDateTime>}
                        />
                        <Field
                            name="Datum ažuriranja"
                            value={<LocalDateTime>{updatedAt}</LocalDateTime>}
                        />
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
                                    <Table.Head>
                                        Datum ažuriranja veze
                                    </Table.Head>
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
                                {accounts.map((account) => (
                                    <Table.Row key={account.id}>
                                        <Table.Cell>
                                            <Link
                                                href={KnownPages.Account(
                                                    account.account.id,
                                                )}
                                            >
                                                <Typography mono>
                                                    {account.account.id}
                                                </Typography>
                                            </Link>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <LocalDateTime>
                                                {account.createdAt}
                                            </LocalDateTime>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <LocalDateTime>
                                                {account.updatedAt}
                                            </LocalDateTime>
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
                                {logins?.usersLogins.map((userLogin) => (
                                    <Table.Row key={userLogin.id}>
                                        <Table.Cell>
                                            <Link
                                                href={KnownPages.User(user.id)}
                                            >
                                                {userLogin.loginType}
                                            </Link>
                                        </Table.Cell>
                                        <Table.Cell>
                                            {userLogin.blockedUntil &&
                                            userLogin.blockedUntil >
                                                new Date() ? (
                                                <Row spacing={1}>
                                                    <Disabled className="text-red-500" />
                                                    <Typography>
                                                        {'Blokiran do '}
                                                        <LocalDateTime>
                                                            {
                                                                userLogin.blockedUntil
                                                            }
                                                        </LocalDateTime>
                                                    </Typography>
                                                    <ServerActionIconButton
                                                        onClick={unblockUserLogin.bind(
                                                            null,
                                                            userLogin.id,
                                                        )}
                                                        title="Odblokiraj"
                                                    >
                                                        <Check className="size-5" />
                                                    </ServerActionIconButton>
                                                </Row>
                                            ) : userLogin.failedAttempts > 0 ? (
                                                <Row spacing={1}>
                                                    <Warning className="text-amber-500" />
                                                    <Stack>
                                                        <Typography>
                                                            {userLogin.failedAttempts +
                                                                ' neuspjelih pokušaja'}
                                                        </Typography>
                                                        <Typography>
                                                            {'Zadnji '}
                                                            <LocalDateTime>
                                                                {
                                                                    userLogin.lastFailedAttempt
                                                                }
                                                            </LocalDateTime>
                                                        </Typography>
                                                    </Stack>
                                                </Row>
                                            ) : (
                                                'Ne'
                                            )}
                                        </Table.Cell>
                                        <Table.Cell>
                                            {userLogin.lastLogin ? (
                                                <LocalDateTime>
                                                    {userLogin.lastLogin}
                                                </LocalDateTime>
                                            ) : (
                                                'Nikad'
                                            )}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <LocalDateTime>
                                                {userLogin.createdAt}
                                            </LocalDateTime>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <LocalDateTime>
                                                {userLogin.updatedAt}
                                            </LocalDateTime>
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
