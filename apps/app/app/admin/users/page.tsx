import { getUsers } from "@gredice/storage";
import { Card, CardHeader, CardOverflow, CardTitle } from "@signalco/ui-primitives/Card";
import { Chip } from "@signalco/ui-primitives/Chip";
import { Table } from "@signalco/ui-primitives/Table";
import { SelectUserRole } from "./SelectUserRole";
import { auth } from "../../../lib/auth/auth";
import { ButtonImpersonateUser } from "./ButtonImpersonateUser";
import Link from "next/link";
import { KnownPages } from "../../../src/KnownPages";
import { NoDataPlaceholder } from "../../../components/shared/placeholders/NoDataPlaceholder";

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
    await auth(['admin']);
    const users = await getUsers();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    {"Korisnici"}
                    <Chip color="primary" size="sm">{users.length}</Chip>
                </CardTitle>
            </CardHeader>
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
                        {users.length === 0 && (
                            <Table.Row>
                                <Table.Cell colSpan={3}>
                                    <NoDataPlaceholder>
                                        Nema korisnika
                                    </NoDataPlaceholder>
                                </Table.Cell>
                            </Table.Row>
                        )}
                        {users.map(user => (
                            <Table.Row key={user.id}>
                                <Table.Cell>
                                    <Link href={KnownPages.User(user.id)}>
                                        {user.userName}
                                    </Link>
                                </Table.Cell>
                                <Table.Cell title={user.role}>
                                    <SelectUserRole user={user} />
                                </Table.Cell>
                                <Table.Cell title={user.createdAt.toISOString()}>{user.createdAt.toLocaleDateString()}</Table.Cell>
                                <Table.Cell>
                                    <ButtonImpersonateUser userId={user.id} />
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            </CardOverflow>
        </Card>
    );
}