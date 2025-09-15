import { getAccounts } from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Table } from '@signalco/ui-primitives/Table';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { KnownPages } from '../../../src/KnownPages';

export async function AccountsTable({ from }: { from?: Date | null }) {
    // Get all accounts
    const allAccounts = await getAccounts();

    // Apply filters
    let filteredAccounts = allAccounts;

    // Apply date filter
    if (from) {
        filteredAccounts = filteredAccounts.filter((account) => {
            return account.createdAt && account.createdAt >= from;
        });
    }

    return (
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.Head>ID</Table.Head>
                    <Table.Head>Korisnicko ime</Table.Head>
                    <Table.Head>Datum kreiranja</Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {filteredAccounts.length === 0 && (
                    <Table.Row>
                        <Table.Cell colSpan={3}>
                            <NoDataPlaceholder>Nema računa</NoDataPlaceholder>
                        </Table.Cell>
                    </Table.Row>
                )}
                {filteredAccounts.map((account) => {
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
                                    {user?.displayName ||
                                        user?.userName ||
                                        'N/A'}
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
    );
}
