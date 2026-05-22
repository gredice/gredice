import { userIdToPublicId } from '@gredice/js/publicId';
import { getUser, getUserWithLogins } from '@gredice/storage';
import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Card, CardHeader, CardOverflow, CardTitle } from '@gredice/ui/Card';
import { Check, Disabled, Warning } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Table } from '@gredice/ui/Table';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
    EntityDetailsPanelCard,
    EntityDetailsPropertiesLayout,
    EntityDetailsPropertiesPanel,
    EntityDetailsPropertiesProvider,
    EntityDetailsPropertiesToggle,
    EntityDetailsPropertyList,
    type EntityDetailsPropertyListItem,
} from '../../../../components/admin/details';
import { AdminPageHeader } from '../../../../components/admin/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { AdminPageTitle } from '../../../../components/admin/navigation/AdminPageTitle';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { ServerActionIconButton } from '../../../../components/shared/ServerActionIconButton';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import { unblockUserLogin } from '../../../(actions)/userActions';
import { ButtonImpersonateUser } from '../ButtonImpersonateUser';
import { SelectUserAvatar } from '../SelectUserAvatar';
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

    const {
        id,
        createdAt,
        updatedAt,
        userName,
        accounts,
        avatarUrl,
        displayName,
    } = user;
    const publicProfileUrl = KnownPages.GrediceUser(userIdToPublicId(id));
    const userTitle = displayName ?? userName;
    const propertyItems: EntityDetailsPropertyListItem[] = [
        { id: 'id', label: 'ID korisnika', value: id, mono: true },
        { id: 'username', label: 'Korisničko ime', value: userName },
        {
            id: 'public-profile',
            label: 'Javni profil',
            value: (
                <a href={publicProfileUrl} rel="noreferrer" target="_blank">
                    Otvori javni profil
                </a>
            ),
        },
        {
            id: 'avatar',
            label: 'Avatar',
            value: (
                <SelectUserAvatar
                    userId={id}
                    avatarUrl={avatarUrl}
                    displayName={displayName ?? userName}
                />
            ),
        },
        {
            id: 'role',
            label: 'Uloga',
            value: <SelectUserRole user={user} />,
        },
        {
            id: 'created-at',
            label: 'Datum kreiranja',
            value: createdAt,
        },
        {
            id: 'updated-at',
            label: 'Datum ažuriranja',
            value: updatedAt,
        },
    ];
    const propertiesPanel = (
        <EntityDetailsPropertiesPanel>
            <EntityDetailsPanelCard title="Detalji">
                <EntityDetailsPropertyList items={propertyItems} />
            </EntityDetailsPanelCard>
        </EntityDetailsPropertiesPanel>
    );

    return (
        <EntityDetailsPropertiesProvider>
            <Stack spacing={8}>
                <AdminPageTitle title={userTitle} />
                <AdminPageHeader
                    breadcrumbs={
                        <Breadcrumbs
                            items={[
                                {
                                    label: <AdminBreadcrumbLevelSelector />,
                                    href: KnownPages.Users,
                                },
                                { label: user.userName },
                            ]}
                        />
                    }
                    actions={
                        <Row className="items-center" spacing={2}>
                            <ButtonImpersonateUser userId={user.id} />
                            <EntityDetailsPropertiesToggle />
                        </Row>
                    }
                    heading={user.userName}
                />
                <EntityDetailsPropertiesLayout properties={propertiesPanel}>
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
                                            <Table.Head>
                                                Datum povezivanja
                                            </Table.Head>
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
                                            <Table.Head>
                                                Zadnja prijava
                                            </Table.Head>
                                            <Table.Head>
                                                Datum kreiranja
                                            </Table.Head>
                                            <Table.Head>
                                                Datum ažuriranja
                                            </Table.Head>
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
                                        {logins?.usersLogins.map(
                                            (userLogin) => (
                                                <Table.Row key={userLogin.id}>
                                                    <Table.Cell>
                                                        <Link
                                                            href={KnownPages.User(
                                                                user.id,
                                                            )}
                                                        >
                                                            {
                                                                userLogin.loginType
                                                            }
                                                        </Link>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        {userLogin.blockedUntil &&
                                                        userLogin.blockedUntil >
                                                            new Date() ? (
                                                            <Row spacing={2}>
                                                                <Disabled className="text-red-500" />
                                                                <Typography>
                                                                    {
                                                                        'Blokiran do '
                                                                    }
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
                                                        ) : userLogin.failedAttempts >
                                                          0 ? (
                                                            <Row spacing={2}>
                                                                <Warning className="text-amber-500" />
                                                                <Stack>
                                                                    <Typography>
                                                                        {userLogin.failedAttempts +
                                                                            ' neuspjelih pokušaja'}
                                                                    </Typography>
                                                                    <Typography>
                                                                        {
                                                                            'Zadnji '
                                                                        }
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
                                                                {
                                                                    userLogin.lastLogin
                                                                }
                                                            </LocalDateTime>
                                                        ) : (
                                                            'Nikad'
                                                        )}
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <LocalDateTime>
                                                            {
                                                                userLogin.createdAt
                                                            }
                                                        </LocalDateTime>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <LocalDateTime>
                                                            {
                                                                userLogin.updatedAt
                                                            }
                                                        </LocalDateTime>
                                                    </Table.Cell>
                                                </Table.Row>
                                            ),
                                        )}
                                    </Table.Body>
                                </Table>
                            </CardOverflow>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Prijave</CardTitle>
                            </CardHeader>
                            <CardOverflow>
                                <Table>
                                    <Table.Header>
                                        <Table.Row>
                                            <Table.Head>Vrsta</Table.Head>
                                            <Table.Head>
                                                Zadnja prijava
                                            </Table.Head>
                                        </Table.Row>
                                    </Table.Header>
                                    <Table.Body>
                                        {logins?.usersLogins.filter(
                                            (l) => l.lastLogin,
                                        ).length === 0 && (
                                            <Table.Row>
                                                <Table.Cell colSpan={2}>
                                                    <NoDataPlaceholder>
                                                        Nema prijava
                                                    </NoDataPlaceholder>
                                                </Table.Cell>
                                            </Table.Row>
                                        )}
                                        {logins?.usersLogins
                                            .filter((l) => l.lastLogin)
                                            .sort(
                                                (a, b) =>
                                                    (b.lastLogin?.getTime() ??
                                                        0) -
                                                    (a.lastLogin?.getTime() ??
                                                        0),
                                            )
                                            .map((userLogin) => (
                                                <Table.Row key={userLogin.id}>
                                                    <Table.Cell>
                                                        {userLogin.loginType}
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        {userLogin.lastLogin ? (
                                                            <LocalDateTime>
                                                                {
                                                                    userLogin.lastLogin
                                                                }
                                                            </LocalDateTime>
                                                        ) : (
                                                            'Nikad'
                                                        )}
                                                    </Table.Cell>
                                                </Table.Row>
                                            ))}
                                    </Table.Body>
                                </Table>
                            </CardOverflow>
                        </Card>
                    </div>
                </EntityDetailsPropertiesLayout>
            </Stack>
        </EntityDetailsPropertiesProvider>
    );
}
