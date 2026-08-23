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
import { OperationCreateModal } from './OperationCreateModal';
import { OperationsFilters } from './OperationsFilters';
import { activeSelectedPlantingFieldIds } from './operationScope';
import {
    getOperationsListContext,
    listOperationsPageFromContext,
} from './operationsListData';
import {
    normalizeOperationsListRecordType,
    parseOperationsListOperationEntityIds,
} from './operationsListQuery';

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
    const operationTargetRaisedBeds = raisedBeds.map((raisedBed) => {
        const selectedPlantingFieldIds = activeSelectedPlantingFieldIds(
            raisedBed.plantings,
        );
        return {
            id: raisedBed.id,
            name: raisedBed.name,
            physicalId: raisedBed.physicalId,
            accountId: raisedBed.accountId,
            gardenId: raisedBed.gardenId,
            fields: raisedBed.fields.map((field) => ({
                id: field.id,
                positionIndex: field.positionIndex,
                hasActiveSelectedPlanting: selectedPlantingFieldIds.has(
                    field.id,
                ),
            })),
        };
    });

    const params = await searchParams;
    const fromFilter =
        typeof params.from === 'string' ? params.from : 'last-14-days';
    const operationEntityIds = parseOperationsListOperationEntityIds(
        typeof params.operations === 'string' ? params.operations : undefined,
    );
    const recordType = normalizeOperationsListRecordType(
        typeof params.type === 'string' ? params.type : undefined,
    );
    const fromDate = getDateFromTimeFilter(fromFilter);
    const operationsListContext = await getOperationsListContext();
    const initialOperationsPage = await listOperationsPageFromContext({
        context: operationsListContext,
        fromDate,
        operationEntityIds,
        recordType,
    });

    return (
        <Stack spacing={4}>
            <AdminPageHeader
                actions={
                    <OperationCreateModal
                        farms={activeFarms}
                        gardens={gardens}
                        raisedBeds={operationTargetRaisedBeds}
                        assignableUsers={assignableUsers}
                    />
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
                        recordType={recordType}
                    />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
