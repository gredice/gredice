import {
    getAssignableFarmUsersByOperationIds,
    getFarms,
} from '@gredice/storage';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { BulkApproveRaisedBedButton } from './BulkApproveRaisedBedButton';
import { BulkAssignRaisedBedButton } from './BulkAssignRaisedBedButton';
import { FarmOperationsScheduleSection } from './FarmOperationsScheduleSection';
import { RaisedBedOperationsScheduleSection } from './RaisedBedOperationsScheduleSection';
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
        <Stack spacing={2}>
            <Row spacing={1} alignItems="center">
                <Typography level="h6">Radnje</Typography>
                <BulkApproveRaisedBedButton
                    physicalId="dan"
                    fields={[]}
                    operations={dayOperationsToApprove}
                />
                <BulkAssignRaisedBedButton
                    physicalId="dan"
                    fields={[]}
                    operations={dayOperationsToAssign}
                />
            </Row>
            {raisedBedGroups.map(({ key, physicalId, raisedBeds: beds }) => {
                return (
                    <RaisedBedOperationsScheduleSection
                        key={key}
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
            })}
            {operationFarms.map((farm) => (
                <FarmOperationsScheduleSection
                    key={farm.id}
                    farm={farm}
                    scheduledOperations={scheduledOperations}
                    operationsData={operationsData}
                    assignableFarmUsersByOperationId={
                        assignableFarmUsersByOperationId
                    }
                />
            ))}
        </Stack>
    );
}
