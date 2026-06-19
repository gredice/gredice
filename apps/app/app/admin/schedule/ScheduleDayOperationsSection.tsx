import {
    getAssignableFarmUsersByOperationIds,
    getFarms,
} from '@gredice/storage';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { FarmOperationsScheduleSection } from './FarmOperationsScheduleSection';
import { RaisedBedOperationsScheduleSection } from './RaisedBedOperationsScheduleSection';
import { ScheduleDayOperationsBulkActions } from './ScheduleDayOperationsBulkActions';
import {
    getScheduleDayData,
    getScheduleOperationsData,
    getSchedulePlantSorts,
} from './scheduleData';
import {
    groupRaisedBedsForSchedule,
    isOperationCancelled,
    isOperationCompleted,
    isOperationPendingVerification,
} from './scheduleShared';
import { OptimisticScheduleActionsProvider } from './useOptimisticScheduleActions';

interface ScheduleDayOperationsSectionProps {
    isToday: boolean;
    date: Date;
}

export async function ScheduleDayOperationsSection({
    isToday,
    date,
}: ScheduleDayOperationsSectionProps) {
    const [{ raisedBeds, scheduledOperations }, plantSorts, operationsData] =
        await Promise.all([
            getScheduleDayData(date.toISOString(), isToday),
            getSchedulePlantSorts(),
            getScheduleOperationsData(),
        ]);
    if (scheduledOperations.length === 0) {
        return null;
    }

    const [assignableFarmUsersByOperationId, farms] = await Promise.all([
        getAssignableFarmUsersByOperationIds(
            scheduledOperations.map((operation) => operation.id),
        ),
        getFarms(),
    ]);

    const affectedRaisedBedIds = [
        ...new Set(
            scheduledOperations
                .map((operation) => operation.raisedBedId)
                .filter((id): id is number => id !== null),
        ),
    ];
    const raisedBedGroups = groupRaisedBedsForSchedule(
        raisedBeds,
        affectedRaisedBedIds,
    );
    const farmOperations = scheduledOperations.filter(
        (operation) =>
            typeof operation.farmId === 'number' &&
            operation.raisedBedId === null,
    );
    const operationFarmIds = new Set(
        farmOperations
            .map((operation) => operation.farmId)
            .filter((farmId): farmId is number => typeof farmId === 'number'),
    );
    const operationFarms = farms
        .filter((farm) => operationFarmIds.has(farm.id))
        .map((farm) => ({ id: farm.id, name: farm.name }));

    const dayOperationsToApprove = scheduledOperations
        .filter(
            (operation) =>
                !operation.isAccepted &&
                !isOperationCompleted(operation.status) &&
                !isOperationCancelled(operation.status) &&
                !!operation.assignedUserId,
        )
        .map((operation) => ({
            id: operation.id,
            label: operation.entityId.toString(),
        }));

    const dayOperationsToAssign = scheduledOperations
        .filter(
            (operation) =>
                !operation.assignedUserId &&
                !isOperationCompleted(operation.status) &&
                !isOperationPendingVerification(operation.status) &&
                !isOperationCancelled(operation.status),
        )
        .map((operation) => ({
            id: operation.id,
            farmUsers: assignableFarmUsersByOperationId[operation.id] ?? [],
        }));

    return (
        <OptimisticScheduleActionsProvider>
            <Stack spacing={4}>
                <Row spacing={2} alignItems="center" className="w-full">
                    <Typography level="h6" className="grow">
                        Radnje
                    </Typography>
                    <Row spacing={1} className="ml-auto shrink-0">
                        <ScheduleDayOperationsBulkActions
                            operationsToApprove={dayOperationsToApprove}
                            operationsToAssign={dayOperationsToAssign}
                        />
                    </Row>
                </Row>
                {raisedBedGroups.map(
                    ({ key, physicalId, raisedBeds: beds }) => {
                        return (
                            <RaisedBedOperationsScheduleSection
                                key={key}
                                date={date}
                                physicalId={physicalId}
                                raisedBeds={beds}
                                scheduledOperations={scheduledOperations}
                                plantSorts={plantSorts}
                                operationsData={operationsData}
                                assignableFarmUsersByOperationId={
                                    assignableFarmUsersByOperationId
                                }
                            />
                        );
                    },
                )}
                {operationFarms.map((farm) => (
                    <FarmOperationsScheduleSection
                        key={farm.id}
                        date={date}
                        farm={farm}
                        scheduledOperations={scheduledOperations}
                        operationsData={operationsData}
                        assignableFarmUsersByOperationId={
                            assignableFarmUsersByOperationId
                        }
                    />
                ))}
            </Stack>
        </OptimisticScheduleActionsProvider>
    );
}
