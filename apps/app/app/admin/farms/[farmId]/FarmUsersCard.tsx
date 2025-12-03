import { getFarmUsers, getUsers } from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import {
    Card,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Table } from '@signalco/ui-primitives/Table';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { KnownPages } from '../../../../src/KnownPages';
import { AssignFarmUserForm } from './AssignFarmUserForm';

export async function FarmUsersCard({ farmId }: { farmId: number }) {
    const [farmUsers, users] = await Promise.all([
        getFarmUsers(farmId),
        getUsers(),
    ]);

    const assignedUserIds = farmUsers.map((farmUser) => farmUser.userId);
    const userOptions = users.map((user) => ({
        id: user.id,
        label: user.displayName
            ? `${user.displayName} (${user.userName})`
            : user.userName,
    }));

    return (
        <Card>
            <CardHeader>
                <CardTitle>Korisnici na farmi</CardTitle>
            </CardHeader>
            <CardContent>
                <AssignFarmUserForm
                    farmId={farmId}
                    users={userOptions}
                    assignedUserIds={assignedUserIds}
                />
            </CardContent>
            <CardOverflow>
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.Head>Korisničko ime</Table.Head>
                            <Table.Head>Prikazano ime</Table.Head>
                            <Table.Head>Dodano</Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {farmUsers.length === 0 && (
                            <Table.Row>
                                <Table.Cell colSpan={3}>
                                    <NoDataPlaceholder>
                                        Nema dodijeljenih korisnika
                                    </NoDataPlaceholder>
                                </Table.Cell>
                            </Table.Row>
                        )}
                        {farmUsers.map((farmUser) => (
                            <Table.Row key={farmUser.id}>
                                <Table.Cell>
                                    <Link
                                        href={KnownPages.User(farmUser.userId)}
                                    >
                                        {farmUser.user?.userName ??
                                            farmUser.userId}
                                    </Link>
                                </Table.Cell>
                                <Table.Cell>
                                    {farmUser.user?.displayName ?? '—'}
                                </Table.Cell>
                                <Table.Cell>
                                    <LocalDateTime>
                                        {farmUser.createdAt}
                                    </LocalDateTime>
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            </CardOverflow>
        </Card>
    );
}
