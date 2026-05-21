import { getUsers } from '@gredice/storage';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Fence, Security, User } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Stack } from '@gredice/ui/Stack';
import { Table } from '@gredice/ui/Table';
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
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Korisnicko ime</Table.Head>
                                <Table.Head>Datum kreiranja</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {filteredUsers.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={2}>
                                        <NoDataPlaceholder>
                                            Nema korisnika
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {filteredUsers.map((user) => {
                                const role = getUserRoleMeta(user.role);

                                return (
                                    <Table.Row key={user.id}>
                                        <Table.Cell>
                                            <div className="flex items-center gap-2">
                                                <span
                                                    title={role.label}
                                                    role="img"
                                                    aria-label={role.label}
                                                    className="text-muted-foreground"
                                                >
                                                    {role.icon}
                                                </span>
                                                <Link
                                                    href={KnownPages.User(
                                                        user.id,
                                                    )}
                                                >
                                                    {user.userName}
                                                </Link>
                                            </div>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <LocalDateTime time={false}>
                                                {user.createdAt}
                                            </LocalDateTime>
                                        </Table.Cell>
                                    </Table.Row>
                                );
                            })}
                        </Table.Body>
                    </Table>
                </CardOverflow>
            </Card>
        </Stack>
    );
}
