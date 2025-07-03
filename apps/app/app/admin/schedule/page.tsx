import { getAllOperations, getAllRaisedBeds, getEntitiesFormatted, getRaisedBedFieldsWithEvents } from "@gredice/storage";
import { EntityStandardized } from "../../../lib/@types/EntityStandardized";
import { Stack } from "@signalco/ui-primitives/Stack";
import { LocaleDateTime } from "../../../components/shared/LocaleDateTime";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Checkbox } from "@signalco/ui-primitives/Checkbox";
import { auth } from "../../../lib/auth/auth";
import { completeOperationAction } from "../../(actions)/operationActions";

export default async function AdminSchedulePage() {
    const { userId } = await auth(["admin"]);
    const [allRaisedBeds, plantSorts, operationsData] = await Promise.all([
        getAllRaisedBeds(),
        getEntitiesFormatted<EntityStandardized>('plantSort'),
        getEntitiesFormatted<EntityStandardized>('operation'),
    ]);

    // Fields
    const fields = (await Promise.all(allRaisedBeds.map(r => r.id).map(getRaisedBedFieldsWithEvents))).flatMap(fields => fields);
    const newFields = fields.filter(field => field.plantStatus === 'new' || field.plantStatus === 'planned');

    // Operations
    const operations = await getAllOperations();
    const newOperations = operations.filter(op => op.status === 'new');

    // Get unique raisedBedIds from new operations and fields
    const affectedRaisedBedIds = [...new Set([
        ...newOperations.map(op => op.raisedBedId),
        ...newFields.map(field => field.raisedBedId)
    ])];
    // Unique physical IDs from raised beds from the new operations and fields
    const physicalIds = [...new Set([
        ...allRaisedBeds.filter(rb => affectedRaisedBedIds.includes(rb.id)).map(rb => rb.physicalId).filter(id => id !== null),
    ])];

    return (
        <Stack>
            <h1 className="text-2xl font-bold mb-4">Admin Schedule</h1>
            {physicalIds.map((physicalId) => {
                const raisedBeds = allRaisedBeds
                    .filter(rb => rb.physicalId === physicalId)
                    .sort((a, b) => a.id - b.id);
                if (!raisedBeds.length) {
                    return null; // Skip if no raised bed found for this physical ID
                }
                return (
                    <div key={physicalId} className="mb-6">
                        <h2 className="text-xl font-semibold mb-2">Gr {physicalId} ({raisedBeds.map(rb => rb.name).join(', ')})</h2>
                        <ul>
                            {newFields.filter(field => raisedBeds.some(rb => rb.id === field.raisedBedId)).map((field) => {
                                const sort = plantSorts?.find(ps => ps.id === field.plantSortId);
                                // seedingDistance is not available in EntityStandardized, so default to 1
                                const numberOfPlants = Math.pow(Math.floor(30 / (sort?.information?.plant?.attributes?.seedingDistance || 30)), 2);
                                // For first raised bed, use positionIndex + 1, second will continue where the first left off
                                // This assumes that positionIndex is unique across all fields in the same raised bed
                                const fieldPositionIndex = raisedBeds.at(0)?.fields.find(f => f.id === field.id) ? field.positionIndex + 1 : field.positionIndex + 10;
                                return (
                                    <li key={field.id}>
                                        <Stack>
                                            {field.plantScheduledDate && (
                                                <Typography level="body2">
                                                    <LocaleDateTime>
                                                        {typeof field.plantScheduledDate === 'string' ? new Date(field.plantScheduledDate) : field.plantScheduledDate}
                                                    </LocaleDateTime>
                                                </Typography>
                                            )}
                                            {fieldPositionIndex} - sijanje: {numberOfPlants} {field.plantSortId ? `${sort?.information?.name}` : '?'}
                                        </Stack>
                                    </li>
                                );
                            })}
                            {newOperations.filter(op => raisedBeds.some(rb => rb.id === op.raisedBedId)).map((op) => {
                                const operationData = operationsData?.find(data => data.id === op.entityId);
                                return (
                                    <li key={op.id}>
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
                                                        {operationData?.information?.label ?? op.entityId}
                                                    </Stack>
                                                )}
                                            />
                                        </form>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                );
            })}
        </Stack>
    );
}