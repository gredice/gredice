import { getAccountUsers } from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import {
    Card,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Table } from '@signalco/ui-primitives/Table';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { KnownPages } from '../../../../src/KnownPages';

export async function AccountUsersCard({ accountId }: { accountId: string }) {
    const users = await getAccountUsers(accountId);

    return (
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
                        {users.map((user) => (
                            <Table.Row key={user.id}>
                                <Table.Cell>
                                    <Link href={KnownPages.User(user.user.id)}>
                                        {user.user.userName}
                                    </Link>
                                </Table.Cell>
                                <Table.Cell>
                                    <LocalDateTime>
                                        {user.createdAt}
                                    </LocalDateTime>
                                </Table.Cell>
                                <Table.Cell>
                                    <LocalDateTime>
                                        {user.updatedAt}
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
