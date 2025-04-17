import { getAccounts } from "@gredice/storage";
import { Card, CardHeader, CardOverflow, CardTitle } from "@signalco/ui-primitives/Card";
import { Chip } from "@signalco/ui-primitives/Chip";
import { Table } from "@signalco/ui-primitives/Table";
import { auth } from "../../../lib/auth/auth";
import { KnownPages } from "../../../src/KnownPages";
import Link from "next/link";
import { NoDataPlaceholder } from "../../../components/shared/placeholders/NoDataPlaceholder";
import { LocaleDateTime } from "../../../components/shared/LocaleDateTime";
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
                <Chip color="primary" size="sm">{accounts.length}</Chip>
            </Row>
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
                            {accounts.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={3}>
                                        <NoDataPlaceholder>
                                            Nema računa
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {accounts.map(account => (
                                <Table.Row key={account.id}>
                                    <Table.Cell>
                                        <Link href={KnownPages.Account(account.id)}>
                                            -
                                        </Link>
                                    </Table.Cell>
                                    <Table.Cell title={account.createdAt.toISOString()}>
                                        <LocaleDateTime time={false}>
                                            {account.createdAt}
                                        </LocaleDateTime>
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