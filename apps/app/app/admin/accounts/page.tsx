import { getAccounts } from "@gredice/storage";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { Chip } from "@signalco/ui-primitives/Chip";
import { Table } from "@signalco/ui-primitives/Table";
import { auth } from "../../../lib/auth/auth";
import { KnownPages } from "../../../src/KnownPages";
import Link from "next/link";
import { NoDataPlaceholder } from "../../../components/shared/placeholders/NoDataPlaceholder";
import { LocalDateTime } from "@gredice/ui/LocalDateTime";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { Stack } from "@signalco/ui-primitives/Stack";

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
    await auth(['admin']);
    const accounts = await getAccounts();

    return (
        <Stack spacing={2}>
            <Row spacing={1}>
                <Typography level="h1" className="text-2xl" semiBold>{"Računi"}</Typography>
                <Chip color="primary">{accounts.length}</Chip>
            </Row>
            <Card>
                <CardOverflow>
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>ID</Table.Head>
                                <Table.Head>Korisnicko ime</Table.Head>
                                <Table.Head>Datum kreiranja</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {accounts.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={3}>
                                        <NoDataPlaceholder>
                                            Nema računa
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {accounts.map(account => {
                                const user = account.accountUsers.at(0)?.user;
                                return (
                                    <Table.Row key={account.id}>
                                        <Table.Cell>
                                            <Link href={KnownPages.Account(account.id)}>
                                                {account.id}
                                            </Link>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Link href={KnownPages.User(user?.id ?? '')}>
                                                {user?.displayName || user?.userName || 'N/A'}
                                            </Link>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <LocalDateTime time={false}>
                                                {account.createdAt}
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