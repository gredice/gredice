import {
    getAllRaisedBedsFiltered,
    getFarms,
    getGardens,
    getUniqueAssignableFarmUsersByFarmIds,
    getUniqueAssignableFarmUsersByGardenIds,
} from '@gredice/storage';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Stack } from '@gredice/ui/Stack';
import { AdminPageHeader } from '../../../components/admin/navigation';
import { OperationsList } from '../../../components/operations/OperationsList';
import { auth } from '../../../lib/auth/auth';
import { getDateFromTimeFilter } from '../../../lib/utils/timeFilters';
import { BulkOperationCreateModal } from './BulkOperationCreateModal';
import { OperationsFilters } from './OperationsFilters';
import {
    getOperationsListContext,
    listOperationsPageFromContext,
} from './operationsListData';
import { parseOperationsListOperationEntityIds } from './operationsListQuery';
import { SingleOperationCreateModal } from './SingleOperationCreateModal';

export const dynamic = 'force-dynamic';

export default async function OperationsPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    await auth(['admin']);
    const [farms, gardens, raisedBeds] = await Promise.all([
        getFarms(),
        getGardens(),
        getAllRaisedBedsFiltered({ status: 'active' }),
    ]);
    const activeFarms = farms
        .filter((farm) => !farm.isDeleted)
        .map((farm) => ({ id: farm.id, name: farm.name }));
    const [assignableFarmUsers, assignableGardenUsers] = await Promise.all([
        getUniqueAssignableFarmUsersByFarmIds(
            activeFarms.map((farm) => farm.id),
        ),
        getUniqueAssignableFarmUsersByGardenIds(
            gardens.map((garden) => garden.id),
        ),
    ]);
    const assignableUsers = Array.from(
        new Map(
            [...assignableFarmUsers, ...assignableGardenUsers].map((user) => [
                user.id,
                user,
            ]),
        ).values(),
    ).map((user) => ({
        id: user.id,
        userName: user.userName,
        displayName: user.displayName,
    }));

    const params = await searchParams;
    const fromFilter =
        typeof params.from === 'string' ? params.from : 'last-14-days';
    const operationEntityIds = parseOperationsListOperationEntityIds(
        typeof params.operations === 'string' ? params.operations : undefined,
    );
    const fromDate = getDateFromTimeFilter(fromFilter);
    const operationsListContext = await getOperationsListContext();
    const initialOperationsPage = await listOperationsPageFromContext({
        context: operationsListContext,
        fromDate,
        operationEntityIds,
    });

    return (
        <Stack spacing={4}>
            <AdminPageHeader
                actions={
                    <div className="flex gap-2">
                        <SingleOperationCreateModal
                            farms={activeFarms}
                            gardens={gardens}
                            raisedBeds={raisedBeds}
                            assignableUsers={assignableUsers}
                        />
                        <BulkOperationCreateModal
                            farms={activeFarms}
                            gardens={gardens}
                            raisedBeds={raisedBeds}
                            assignableUsers={assignableUsers}
                        />
                    </div>
                }
            />
            <OperationsFilters
                operationOptions={operationsListContext.operationFilterOptions}
                selectedOperationEntityIds={operationEntityIds}
            />
            <Card>
                <CardOverflow>
                    <OperationsList
                        fromFilter={fromFilter}
                        initialPage={initialOperationsPage}
                        operationEntityIds={operationEntityIds}
                    />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
