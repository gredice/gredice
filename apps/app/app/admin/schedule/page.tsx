import { getAllOperations, getAllRaisedBeds, getEntitiesFormatted } from "@gredice/storage";
import { EntityStandardized } from "../../../lib/@types/EntityStandardized";
import { auth } from "../../../lib/auth/auth";
import { ScheduleClient } from "./ScheduleClient";

export const dynamic = 'force-dynamic';

export default async function AdminSchedulePage() {
    const { userId } = await auth(['admin']);
    const [allRaisedBeds, operations, plantSorts, operationsData] = await Promise.all([
        getAllRaisedBeds(),
        getAllOperations(),
        getEntitiesFormatted<EntityStandardized>('plantSort'),
        getEntitiesFormatted<EntityStandardized>('operation'),
    ]);

    return (
        <ScheduleClient
            allRaisedBeds={allRaisedBeds}
            operations={operations}
            plantSorts={plantSorts}
            operationsData={operationsData}
            userId={userId}
        />
    );
}