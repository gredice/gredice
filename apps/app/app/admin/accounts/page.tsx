import { getAccounts, getUsers } from "@gredice/storage";
import { Card, CardHeader, CardOverflow, CardTitle } from "@signalco/ui-primitives/Card";
import { Chip } from "@signalco/ui-primitives/Chip";
import { Table } from "@signalco/ui-primitives/Table";
import { auth } from "../../../lib/auth/auth";
import { KnownPages } from "../../../src/KnownPages";
import Link from "next/link";
import { NoDataPlaceholder } from "../../../components/shared/placeholders/NoDataPlaceholder";

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
    await auth(['admin']);
    const accounts = await getAccounts();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    {"Računi"}
                    <Chip color="primary" size="sm">{accounts.length}</Chip>
                </CardTitle>
            </CardHeader>
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
                                <Table.Cell title={account.createdAt.toISOString()}>{account.createdAt.toLocaleDateString()}</Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            </CardOverflow>
        </Card>
    );
}