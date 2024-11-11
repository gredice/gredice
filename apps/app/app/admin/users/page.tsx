import { getUsers } from "@gredice/storage";
import { Card, CardContent, CardHeader, CardOverflow, CardTitle } from "@signalco/ui-primitives/Card";
import { Chip } from "@signalco/ui-primitives/Chip";
import { Table } from "@signalco/ui-primitives/Table";

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
    const users = await getUsers();

    return (
        <div className="p-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        {"Korisnici"}
                        <Chip color="primary">{users.length}</Chip>
                    </CardTitle>
                </CardHeader>
                <CardOverflow>
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Korisnicko ime</Table.Head>
                                <Table.Head>Uloga</Table.Head>
                                <Table.Head>Datum kreiranja</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {users.map(user => (
                                <Table.Row key={user.id}>
                                    <Table.Cell>{user.userName}</Table.Cell>
                                    <Table.Cell title={user.role}>{user.role === 'admin' ? 'Administrator' : 'Korisnik'}</Table.Cell>
                                    <Table.Cell title={user.createdAt.toISOString()}>{user.createdAt.toLocaleDateString()}</Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                </CardOverflow>
            </Card>
        </div>
    )
}