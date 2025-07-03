import { getAllRaisedBeds, getEntitiesFormatted, getRaisedBedFieldsWithEvents } from "@gredice/storage";
import { EntityStandardized } from "../../../lib/@types/EntityStandardized";

export default async function AdminSchedulePage() {
    const raisedBeds = await getAllRaisedBeds();
    const fields = (await Promise.all(raisedBeds.map(r => r.id).map(getRaisedBedFieldsWithEvents))).flatMap(fields => fields)

    const plantSorts = await getEntitiesFormatted('plantSort') as EntityStandardized[];

    // Group fields by raisedBedId
    const groupedFields = fields
        .filter(field => field.plantStatus === 'new' || field.plantStatus === 'planned')
        .reduce((acc, field) => {
            if (!acc[field.raisedBedId]) acc[field.raisedBedId] = [];
            acc[field.raisedBedId].push(field);
            return acc;
        }, {} as Record<string, typeof fields>);

    return (
        <div className="flex flex-col items-center justify-center h-full">
            <h1 className="text-2xl font-bold mb-4">Admin Schedule</h1>
            {Object.entries(groupedFields).map(([raisedBedId, group]) => (
                <div key={raisedBedId} className="mb-6">
                    <h2 className="text-xl font-semibold mb-2">Raised Bed: {raisedBedId}</h2>
                    <ul>
                        {group.map((field) => {
                            const sort = plantSorts.find(ps => ps.id === field.plantSortId);
                            // seedingDistance is not available in EntityStandardized, so default to 1
                            const numberOfPlants = Math.pow(Math.floor(30 / (sort?.information?.plant?.attributes?.seedingDistance || 30)), 2);
                            return (
                                <li key={field.id}>
                                    {field.positionIndex + 1} - sijanje: {numberOfPlants} {field.plantSortId ? `${sort?.information?.name}` : '?'}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </div>
    );
}