import { getUsers } from "@gredice/storage";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { Chip } from "@signalco/ui-primitives/Chip";
import { Table } from "@signalco/ui-primitives/Table";
import { SelectUserRole } from "./SelectUserRole";
import { auth } from "../../../lib/auth/auth";
import { ButtonImpersonateUser } from "./ButtonImpersonateUser";
import Link from "next/link";
import { KnownPages } from "../../../src/KnownPages";
import { NoDataPlaceholder } from "../../../components/shared/placeholders/NoDataPlaceholder";
import { LocalDateTime } from "@gredice/ui/LocalDateTime";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { Stack } from "@signalco/ui-primitives/Stack";

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
    await auth(['admin']);
    const users = await getUsers();

    return (
        <Stack spacing={2}>

            <Row spacing={1}>
                <Typography level="h1" className="text-2xl" semiBold>{"Korisnici"}</Typography>
                <Chip color="primary">{users.length}</Chip>
            </Row>
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
                                    <Table.Cell>
                                        <LocalDateTime time={false}>
                                            {user.createdAt}
                                        </LocalDateTime>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <ButtonImpersonateUser userId={user.id} />
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