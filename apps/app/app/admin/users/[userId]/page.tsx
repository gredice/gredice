import { userIdToPublicId } from '@gredice/js/publicId';
import { getUser, getUserWithLogins } from '@gredice/storage';
import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Card, CardHeader, CardOverflow, CardTitle } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { Check, Disabled, Warning } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
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
    const loginHistory = (logins?.usersLogins ?? [])
        .filter((login) => login.lastLogin)
        .sort(
            (a, b) =>
                (b.lastLogin?.getTime() ?? 0) - (a.lastLogin?.getTime() ?? 0),
        );
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
                                {accounts.length === 0 ? (
                                    <div className="p-4">
                                        <NoDataPlaceholder>
                                            Nema povezanih računa
                                        </NoDataPlaceholder>
                                    </div>
                                ) : (
                                    <ul className="divide-y">
                                        {accounts.map((account) => (
                                            <li
                                                key={account.id}
                                                className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                                            >
                                                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="min-w-0">
                                                        <Typography
                                                            level="body3"
                                                            className="mb-1 text-muted-foreground"
                                                        >
                                                            Račun
                                                        </Typography>
                                                        <Link
                                                            href={KnownPages.Account(
                                                                account.account
                                                                    .id,
                                                            )}
                                                            className="block min-w-0 break-all text-sm font-medium text-primary underline-offset-4 hover:underline"
                                                        >
                                                            <Typography
                                                                component="span"
                                                                mono
                                                            >
                                                                {
                                                                    account
                                                                        .account
                                                                        .id
                                                                }
                                                            </Typography>
                                                        </Link>
                                                    </div>
                                                    <div className="flex min-w-0 flex-col gap-1 text-left sm:items-end sm:text-right">
                                                        <Typography
                                                            component="div"
                                                            level="body3"
                                                            className="text-muted-foreground"
                                                        >
                                                            Povezan:{' '}
                                                            <LocalDateTime>
                                                                {
                                                                    account.createdAt
                                                                }
                                                            </LocalDateTime>
                                                        </Typography>
                                                        <Typography
                                                            component="div"
                                                            level="body3"
                                                            className="text-muted-foreground"
                                                        >
                                                            Ažurirano:{' '}
                                                            <LocalDateTime>
                                                                {
                                                                    account.updatedAt
                                                                }
                                                            </LocalDateTime>
                                                        </Typography>
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardOverflow>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Načini prijave</CardTitle>
                            </CardHeader>
                            <CardOverflow>
                                {logins?.usersLogins.length === 0 ? (
                                    <div className="p-4">
                                        <NoDataPlaceholder>
                                            Nema načina prijave
                                        </NoDataPlaceholder>
                                    </div>
                                ) : (
                                    <ul className="divide-y">
                                        {logins?.usersLogins.map(
                                            (userLogin) => {
                                                const blockedUntil =
                                                    userLogin.blockedUntil;
                                                const isBlocked = blockedUntil
                                                    ? blockedUntil > new Date()
                                                    : false;
                                                return (
                                                    <li
                                                        key={userLogin.id}
                                                        className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                                                    >
                                                        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                            <Stack
                                                                spacing={2}
                                                                className="min-w-0"
                                                            >
                                                                <Link
                                                                    href={KnownPages.User(
                                                                        user.id,
                                                                    )}
                                                                    className="min-w-0 break-words text-sm font-medium text-primary underline-offset-4 hover:underline"
                                                                >
                                                                    {
                                                                        userLogin.loginType
                                                                    }
                                                                </Link>
                                                                {isBlocked ? (
                                                                    <Row
                                                                        spacing={
                                                                            2
                                                                        }
                                                                        className="min-w-0 flex-wrap"
                                                                    >
                                                                        <Disabled className="size-5 shrink-0 text-red-500" />
                                                                        <Typography
                                                                            level="body3"
                                                                            className="text-muted-foreground"
                                                                        >
                                                                            {
                                                                                'Blokiran do '
                                                                            }
                                                                            {blockedUntil ? (
                                                                                <LocalDateTime>
                                                                                    {
                                                                                        blockedUntil
                                                                                    }
                                                                                </LocalDateTime>
                                                                            ) : null}
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
                                                                    <Row
                                                                        spacing={
                                                                            2
                                                                        }
                                                                        className="min-w-0 items-start"
                                                                    >
                                                                        <Warning className="size-5 shrink-0 text-amber-500" />
                                                                        <Stack
                                                                            spacing={
                                                                                1
                                                                            }
                                                                        >
                                                                            <Typography level="body3">
                                                                                {userLogin.failedAttempts +
                                                                                    ' neuspjelih pokušaja'}
                                                                            </Typography>
                                                                            <Typography
                                                                                level="body3"
                                                                                className="text-muted-foreground"
                                                                            >
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
                                                                    <Typography
                                                                        level="body3"
                                                                        className="text-muted-foreground"
                                                                    >
                                                                        Nije
                                                                        blokiran
                                                                    </Typography>
                                                                )}
                                                            </Stack>
                                                            <div className="flex shrink-0 flex-col gap-2 lg:items-end">
                                                                <Chip
                                                                    color={
                                                                        isBlocked
                                                                            ? 'error'
                                                                            : userLogin.failedAttempts >
                                                                                0
                                                                              ? 'warning'
                                                                              : 'neutral'
                                                                    }
                                                                    size="sm"
                                                                    variant="soft"
                                                                    className="w-fit"
                                                                >
                                                                    {isBlocked
                                                                        ? 'Blokiran'
                                                                        : userLogin.failedAttempts >
                                                                            0
                                                                          ? 'Upozorenje'
                                                                          : 'Aktivan'}
                                                                </Chip>
                                                                <div className="flex flex-col gap-1 text-left lg:items-end lg:text-right">
                                                                    <Typography
                                                                        component="div"
                                                                        level="body3"
                                                                        className="text-muted-foreground"
                                                                    >
                                                                        Zadnja
                                                                        prijava:{' '}
                                                                        {userLogin.lastLogin ? (
                                                                            <LocalDateTime>
                                                                                {
                                                                                    userLogin.lastLogin
                                                                                }
                                                                            </LocalDateTime>
                                                                        ) : (
                                                                            'Nikad'
                                                                        )}
                                                                    </Typography>
                                                                    <Typography
                                                                        component="div"
                                                                        level="body3"
                                                                        className="text-muted-foreground"
                                                                    >
                                                                        Kreirano:{' '}
                                                                        <LocalDateTime>
                                                                            {
                                                                                userLogin.createdAt
                                                                            }
                                                                        </LocalDateTime>
                                                                    </Typography>
                                                                    <Typography
                                                                        component="div"
                                                                        level="body3"
                                                                        className="text-muted-foreground"
                                                                    >
                                                                        Ažurirano:{' '}
                                                                        <LocalDateTime>
                                                                            {
                                                                                userLogin.updatedAt
                                                                            }
                                                                        </LocalDateTime>
                                                                    </Typography>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </li>
                                                );
                                            },
                                        )}
                                    </ul>
                                )}
                            </CardOverflow>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Prijave</CardTitle>
                            </CardHeader>
                            <CardOverflow>
                                {loginHistory.length === 0 ? (
                                    <div className="p-4">
                                        <NoDataPlaceholder>
                                            Nema prijava
                                        </NoDataPlaceholder>
                                    </div>
                                ) : (
                                    <ul className="divide-y">
                                        {loginHistory.map((userLogin) => (
                                            <li
                                                key={userLogin.id}
                                                className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                                            >
                                                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                    <Typography
                                                        level="body2"
                                                        semiBold
                                                        className="min-w-0 break-words"
                                                    >
                                                        {userLogin.loginType}
                                                    </Typography>
                                                    <Typography
                                                        component="div"
                                                        level="body3"
                                                        className="text-muted-foreground sm:text-right"
                                                    >
                                                        Zadnja prijava:{' '}
                                                        {userLogin.lastLogin ? (
                                                            <LocalDateTime>
                                                                {
                                                                    userLogin.lastLogin
                                                                }
                                                            </LocalDateTime>
                                                        ) : (
                                                            'Nikad'
                                                        )}
                                                    </Typography>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardOverflow>
                        </Card>
                    </div>
                </EntityDetailsPropertiesLayout>
            </Stack>
        </EntityDetailsPropertiesProvider>
    );
}
