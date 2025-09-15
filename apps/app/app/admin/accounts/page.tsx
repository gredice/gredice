import { getAccounts } from '@gredice/storage';
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
import { AccountsFilters } from './AccountsFilters';

export const dynamic = 'force-dynamic';

export default async function AccountsPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    await auth(['admin']);
    const params = await searchParams;

    // Get filter parameters
    const typeFilter = typeof params.type === 'string' ? params.type : '';
    const fromFilter =
        typeof params.from === 'string' ? params.from : 'last-30-days';
    const fromDate = getDateFromTimeFilter(fromFilter);

    // Get all accounts
    const allAccounts = await getAccounts();

    // Apply filters
    let filteredAccounts = allAccounts;

    // Apply type filter (this would need to be expanded based on your account schema)
    if (typeFilter) {
        // For now, this is a placeholder - you'd need to check your account schema
        // filteredAccounts = filteredAccounts.filter(account => account.type === typeFilter);
    }

    // Apply date filter
    if (fromDate) {
        filteredAccounts = filteredAccounts.filter((account) => {
            return account.createdAt && account.createdAt >= fromDate;
        });
    }

    return (
        <Stack spacing={2}>
            <Row spacing={1}>
                <Typography level="h1" className="text-2xl" semiBold>
                    {'Računi'}
                </Typography>
                <Chip color="primary">{filteredAccounts.length}</Chip>
            </Row>

            <AccountsFilters />

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
                            {filteredAccounts.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={3}>
                                        <NoDataPlaceholder>
                                            Nema računa
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {filteredAccounts.map((account) => {
                                const user = account.accountUsers.at(0)?.user;
                                return (
                                    <Table.Row key={account.id}>
                                        <Table.Cell>
                                            <Link
                                                href={KnownPages.Account(
                                                    account.id,
                                                )}
                                            >
                                                {account.id}
                                            </Link>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Link
                                                href={KnownPages.User(
                                                    user?.id ?? '',
                                                )}
                                            >
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
                </CardOverflow>
            </Card>
        </Stack>
    );
}
