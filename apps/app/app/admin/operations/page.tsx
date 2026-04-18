import {
    getAllRaisedBeds,
    getAssignableFarmUsersByGardenIds,
    getGardens,
} from '@gredice/storage';
import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
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
    const assignableFarmUsersByGardenId =
        await getAssignableFarmUsersByGardenIds(
            gardens.map((garden) => garden.id),
        );
    const assignableUsers = Array.from(
        new Map(
            Object.values(assignableFarmUsersByGardenId)
                .flat()
                .map((user) => [
                    user.id,
                    {
                        id: user.id,
                        userName: user.userName,
                        displayName: user.displayName,
                    },
                ]),
        ).values(),
    );

    const params = await searchParams;
    const fromFilter =
        typeof params.from === 'string' ? params.from : 'last-14-days';
    const fromDate = getDateFromTimeFilter(fromFilter);

    return (
        <Stack spacing={2}>
            <Row justifyContent="space-between">
                <Typography level="h1" className="text-2xl" semiBold>
                    Radnje
                </Typography>
                <BulkOperationCreateModal
                    gardens={gardens}
                    raisedBeds={raisedBeds}
                    assignableUsers={assignableUsers}
                />
            </Row>
            <OperationsFilters />
            <Card>
                <CardOverflow>
                    <OperationsTable fromDate={fromDate} />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
