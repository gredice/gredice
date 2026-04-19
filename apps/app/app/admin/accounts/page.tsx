import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import { auth } from '../../../lib/auth/auth';
import { getDateFromTimeFilter } from '../../../lib/utils/timeFilters';
import { AccountsFilters } from './AccountsFilters';
import { AccountsTable } from './AccountsTable';

export default async function AccountsPage({
    searchParams,
}: PageProps<'/admin/accounts'>) {
    await auth(['admin']);
    const params = await searchParams;
    const fromFilter =
        typeof params.from === 'string' ? params.from : 'last-30-days';
    const fromDate = getDateFromTimeFilter(fromFilter);

    return (
        <Stack spacing={2}>
            <AccountsFilters />

            <Card>
                <CardOverflow>
                    <AccountsTable from={fromDate} />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
