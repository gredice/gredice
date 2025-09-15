import { getUsers } from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../lib/auth/auth';
import { getDateFromTimeFilter } from '../../../lib/utils/timeFilters';
import { KnownPages } from '../../../src/KnownPages';
import { ButtonImpersonateUser } from './ButtonImpersonateUser';
import { SelectUserRole } from './SelectUserRole';
import { UsersFilters } from './UsersFilters';

export const dynamic = 'force-dynamic';

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
        <Stack spacing={2}>
            <Row spacing={1}>
                <Typography level="h1" className="text-2xl" semiBold>
                    {'Korisnici'}
                </Typography>
                <Chip color="primary">{filteredUsers.length}</Chip>
            </Row>

            <UsersFilters />

            <Card>
                <CardOverflow>
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Korisnicko ime</Table.Head>
                                <Table.Head>Uloga</Table.Head>
                                <Table.Head>Datum kreiranja</Table.Head>
                                <Table.Head></Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {filteredUsers.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={3}>
                                        <NoDataPlaceholder>
                                            Nema korisnika
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {filteredUsers.map((user) => (
                                <Table.Row key={user.id}>
                                    <Table.Cell>
                                        <Link href={KnownPages.User(user.id)}>
                                            {user.userName}
                                        </Link>
                                    </Table.Cell>
                                    <Table.Cell title={user.role}>
                                        <SelectUserRole user={user} />
                                    </Table.Cell>
                                    <Table.Cell>
                                        <LocalDateTime time={false}>
                                            {user.createdAt}
                                        </LocalDateTime>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <ButtonImpersonateUser
                                            userId={user.id}
                                        />
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
