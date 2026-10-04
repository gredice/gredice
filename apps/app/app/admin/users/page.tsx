import { getUsers } from '@gredice/storage';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Fence, Security, User } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../lib/auth/auth';
import { getDateFromTimeFilter } from '../../../lib/utils/timeFilters';
import { KnownPages } from '../../../src/KnownPages';
import { UsersFilters } from './UsersFilters';

export const dynamic = 'force-dynamic';

function getUserRoleMeta(role: string) {
    switch (role) {
        case 'admin':
            return {
                label: 'Administrator',
                icon: <Security className="size-5" aria-hidden />,
            };
        case 'farmer':
            return {
                label: 'Poljoprivrednik',
                icon: <Fence className="size-5" aria-hidden />,
            };
        case 'user':
            return {
                label: 'Korisnik',
                icon: <User className="size-5" aria-hidden />,
            };
        default:
            return {
                label: role,
                icon: <User className="size-5" aria-hidden />,
            };
    }
}

export default async function UsersPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    await auth(['admin']);
    const params = await searchParams;

    // Get filter parameters
    const roleFilter = typeof params.role === 'string' ? params.role : '';
    const fromFilter =
        typeof params.from === 'string' ? params.from : 'last-30-days';
    const fromDate = getDateFromTimeFilter(fromFilter);

    // Get all users
    const allUsers = await getUsers();

    // Apply filters
    let filteredUsers = allUsers;

    // Apply role filter
    if (roleFilter) {
        filteredUsers = filteredUsers.filter(
            (user) => user.role === roleFilter,
        );
    }

    // Apply date filter
    if (fromDate) {
        filteredUsers = filteredUsers.filter((user) => {
            return user.createdAt && user.createdAt >= fromDate;
        });
    }

    return (
        <Stack spacing={4}>
            <UsersFilters />

            <Card>
                <CardOverflow>
                    <div className="min-w-0">
                        {filteredUsers.length === 0 ? (
                            <div className="p-4">
                                <NoDataPlaceholder>
                                    Nema korisnika
                                </NoDataPlaceholder>
                            </div>
                        ) : (
                            <ul className="divide-y">
                                {filteredUsers.map((user) => {
                                    const role = getUserRoleMeta(user.role);

                                    return (
                                        <li
                                            key={user.id}
                                            className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                                        >
                                            <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <span
                                                        title={role.label}
                                                        role="img"
                                                        aria-label={role.label}
                                                        className="shrink-0 text-muted-foreground"
                                                    >
                                                        {role.icon}
                                                    </span>
                                                    <Link
                                                        href={KnownPages.User(
                                                            user.id,
                                                        )}
                                                        className="min-w-0 truncate text-sm font-medium text-primary underline-offset-4 hover:underline"
                                                    >
                                                        {user.userName}
                                                    </Link>
                                                </div>
                                                <Typography
                                                    component="span"
                                                    level="body3"
                                                    className="pl-7 text-muted-foreground sm:pl-0 sm:text-right"
                                                >
                                                    Kreiran:{' '}
                                                    <span className="whitespace-nowrap">
                                                        <LocalDateTime
                                                            time={false}
                                                        >
                                                            {user.createdAt}
                                                        </LocalDateTime>
                                                    </span>
                                                </Typography>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </CardOverflow>
            </Card>
        </Stack>
    );
}
