import {
    getAllRaisedBeds,
    getGardens,
    getUniqueAssignableFarmUsersByGardenIds,
} from '@gredice/storage';
import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import { AdminPageHeader } from '../../../components/admin/navigation';
import { OperationsTable } from '../../../components/operations/OperationsTable';
import { auth } from '../../../lib/auth/auth';
import { getDateFromTimeFilter } from '../../../lib/utils/timeFilters';
import { BulkOperationCreateModal } from './BulkOperationCreateModal';
import { OperationsFilters } from './OperationsFilters';

export const dynamic = 'force-dynamic';

export default async function OperationsPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    await auth(['admin']);
    const [gardens, raisedBeds] = await Promise.all([
        getGardens(),
        getAllRaisedBeds(),
    ]);
    const assignableUsers = (
        await getUniqueAssignableFarmUsersByGardenIds(
            gardens.map((garden) => garden.id),
        )
    ).map((user) => ({
        id: user.id,
        userName: user.userName,
        displayName: user.displayName,
    }));

    const params = await searchParams;
    const fromFilter =
        typeof params.from === 'string' ? params.from : 'last-14-days';
    const fromDate = getDateFromTimeFilter(fromFilter);

    return (
        <Stack spacing={2}>
            <AdminPageHeader
                actions={
                    <BulkOperationCreateModal
                        gardens={gardens}
                        raisedBeds={raisedBeds}
                        assignableUsers={assignableUsers}
                    />
                }
            />
            <OperationsFilters />
            <Card>
                <CardOverflow>
                    <OperationsTable fromDate={fromDate} />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
