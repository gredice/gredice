import { getAllOperations, getAllRaisedBeds, getEntitiesFormatted, getRaisedBedFieldsWithEvents, SelectRaisedBed } from "@gredice/storage";
import { EntityStandardized } from "../../../lib/@types/EntityStandardized";
import { Stack } from "@signalco/ui-primitives/Stack";
import { LocaleDateTime } from "../../../components/shared/LocaleDateTime";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Checkbox } from "@signalco/ui-primitives/Checkbox";
import { auth } from "../../../lib/auth/auth";
import { completeOperationAction } from "../../(actions)/operationActions";
import { Divider } from "@signalco/ui-primitives/Divider";

function useDaySchedule(isToday: boolean, date: Date, raisedBeds: Awaited<ReturnType<typeof getAllRaisedBeds>>, operations: Awaited<ReturnType<typeof getAllOperations>>) {
    const todaysNewFields = raisedBeds.flatMap(rb => rb.fields).filter(field =>
        (field.plantStatus === 'new' || field.plantStatus === 'planned') &&
        ((!field.plantScheduledDate && isToday) ||
            (field.plantScheduledDate && (
                date.toDateString() === new Date(field.plantScheduledDate).toDateString() || // For specific scheduled date
                date > new Date(field.plantScheduledDate) && isToday
            ))));
    const todaysNewOperations = operations.filter(op =>
        (op.status === 'new' || op.status === 'planned') &&
        ((!op.scheduledDate && isToday) ||
            (op.scheduledDate && (
                date.toDateString() === new Date(op.scheduledDate).toDateString() || // For specific scheduled date
                date > new Date(op.scheduledDate) && isToday
            ))));

    // Get unique raisedBedIds from new operations and fields
    const todayAffectedRaisedBedIds = [...new Set([
        ...todaysNewOperations.map(op => op.raisedBedId),
        ...todaysNewFields.map(field => field.raisedBedId)
    ])];

    // Unique physical IDs from raised beds from the new operations and fields
    const physicalIds = [...new Set([
        ...raisedBeds.filter(rb => todayAffectedRaisedBedIds.includes(rb.id)).map(rb => rb.physicalId).filter(id => id !== null),
    ])].sort((a, b) => Number(a) - Number(b));

    return {
        newFields: todaysNewFields,
        newOperations: todaysNewOperations,
        affectedRaisedBedPhysicalIds: physicalIds,
    }
}

async function ScheduleDay({ isToday, date, allRaisedBeds, operations, plantSorts, operationsData }: {
    isToday: boolean,
    date: Date,
    allRaisedBeds: Awaited<ReturnType<typeof getAllRaisedBeds>>,
    operations: Awaited<ReturnType<typeof getAllOperations>>,
    plantSorts: Awaited<ReturnType<typeof getEntitiesFormatted<EntityStandardized>>>,
    operationsData: Awaited<ReturnType<typeof getEntitiesFormatted<EntityStandardized>>>
}) {
    const { userId } = await auth(["admin"]);
    const { newFields, newOperations, affectedRaisedBedPhysicalIds } = useDaySchedule(isToday, date, allRaisedBeds, operations);

    return (
        <Stack spacing={2}>
            {affectedRaisedBedPhysicalIds.map((physicalId) => {
                const raisedBeds = allRaisedBeds
                    .filter(rb => rb.physicalId === physicalId)
                    .sort((a, b) => a.id - b.id);
                if (!raisedBeds.length) {
                    return null; // Skip if no raised bed found for this physical ID
                }
                return (
                    <div key={physicalId}>
                        <Typography level="body1">Gr {physicalId} ({raisedBeds.map(rb => rb.name).join(', ')})</Typography>
                        <Stack>
                            {newFields.filter(field => raisedBeds.some(rb => rb.id === field.raisedBedId)).map((field) => {
                                const sort = plantSorts?.find(ps => ps.id === field.plantSortId);
                                // seedingDistance is not available in EntityStandardized, so default to 1
                                const numberOfPlants = Math.pow(Math.floor(30 / (sort?.information?.plant?.attributes?.seedingDistance || 30)), 2);
                                // For first raised bed, use positionIndex + 1, second will continue where the first left off
                                // This assumes that positionIndex is unique across all fields in the same raised bed
                                const fieldPositionIndex = raisedBeds.at(0)?.fields.find(f => f.id === field.id) ? field.positionIndex + 1 : field.positionIndex + 10;

                                return (
                                    <div key={field.id}>
                                        <form className="w-fit">
                                            <input type="hidden" name="fieldId" value={field.id} />
                                            <input type="hidden" name="completedBy" value={userId} />
                                            <Checkbox
                                                type="submit"
                                                label={(
                                                    <Stack>
                                                        <span>{fieldPositionIndex} - sijanje: {numberOfPlants} {field.plantSortId ? `${sort?.information?.name}` : '?'}</span>
                                                    </Stack>
                                                )}
                                            />
                                        </form>
                                    </div>
                                );
                            })}
                            {newOperations.filter(op => raisedBeds.some(rb => rb.id === op.raisedBedId)).map((op) => {
                                const operationData = operationsData?.find(data => data.id === op.entityId);
                                return (
                                    <div key={op.id}>
                                        <form action={completeOperationAction}>
                                            <input type="hidden" name="operationId" value={op.id} />
                                            <input type="hidden" name="completedBy" value={userId} />
                                            <Checkbox
                                                type="submit"
                                                label={(
                                                    <Stack>
                                                        {op.scheduledDate && (
                                                            <Typography level="body2">
                                                                <LocaleDateTime>
                                                                    {typeof op.scheduledDate === 'string' ? new Date(op.scheduledDate) : op.scheduledDate}
                                                                </LocaleDateTime>
                                                            </Typography>
                                                        )}
                                                        <span>{operationData?.information?.label ?? op.entityId}</span>
                                                    </Stack>
                                                )}
                                            />
                                        </form>
                                    </div>
                                );
                            })}
                        </Stack>
                    </div>
                );
            })}
        </Stack>
    )
}

export default async function AdminSchedulePage() {
    const [allRaisedBeds, operations, plantSorts, operationsData] = await Promise.all([
        getAllRaisedBeds(),
        getAllOperations(),
        getEntitiesFormatted<EntityStandardized>('plantSort'),
        getEntitiesFormatted<EntityStandardized>('operation'),
    ]);
    const dates = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() + i);
        return date;
    });

    return (
        <Stack spacing={4}>
            <Typography level="h1">Rasprored operacija</Typography>
            <Stack spacing={4}>
                {dates.map((date, dateIndex) => {
                    return (
                        <Stack key={date.toISOString()} spacing={1}>
                            <Typography level="h5">
                                <LocaleDateTime>{date}</LocaleDateTime>
                            </Typography>
                            <ScheduleDay
                                isToday={dateIndex === 0}
                                date={date}
                                allRaisedBeds={allRaisedBeds}
                                operations={operations}
                                plantSorts={plantSorts}
                                operationsData={operationsData} />
                            <Divider />
                        </Stack>
                    );
                })}
            </Stack>
        </Stack>
    );
}