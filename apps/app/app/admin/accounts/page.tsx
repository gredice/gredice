import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
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
            <Row spacing={1}>
                <Typography level="h1" className="text-2xl" semiBold>
                    {'Računi'}
                </Typography>
            </Row>

            <AccountsFilters />

            <Card>
                <CardOverflow>
                    <AccountsTable from={fromDate} />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
