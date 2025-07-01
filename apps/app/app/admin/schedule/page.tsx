import { getAllRaisedBeds, getRaisedBedFieldsWithEvents } from "@gredice/storage";

export default async function AdminSchedulePage() {
    const raisedBeds = await getAllRaisedBeds();
    const fields = (await Promise.all(raisedBeds.map(r => r.id).map(getRaisedBedFieldsWithEvents))).flatMap(fields => fields)

    return (
        <div className="flex flex-col items-center justify-center h-full">
            <h1 className="text-2xl font-bold mb-4">Admin Schedule</h1>
            <ul>
                {fields.filter(field => field.plantStatus === 'new' || field.plantStatus === 'planned').map((field) => (
                    <li key={field.id}>
                        {field.raisedBedId}: {field.plantStatus}
                    </li>
                ))}
            </ul>
        </div>
    );
}