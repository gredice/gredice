import {
    getAllOperations,
    getAllRaisedBeds,
    getEntitiesFormatted,
} from '@gredice/storage';
import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';
import { auth } from '../../../lib/auth/auth';
import { ScheduleClient } from './ScheduleClient';

export const dynamic = 'force-dynamic';
const operationsBackDays = 90;

export default async function AdminSchedulePage() {
    const { userId } = await auth(['admin']);
    const [
        allRaisedBeds,
        newOrScheduledOperations,
        completedOperationsFuture,
        plantSorts,
        operationsData,
    ] = await Promise.all([
        getAllRaisedBeds(),
        getAllOperations({
            // 90 days back
            from: new Date(
                new Date().setDate(new Date().getDate() - operationsBackDays),
            ),
            status: ['new', 'planned'],
        }),
        getAllOperations({
            completedFrom: new Date(new Date().setHours(0, 0, 0, 0)),
            status: 'completed',
        }),
        getEntitiesFormatted<EntityStandardized>('plantSort'),
        getEntitiesFormatted<EntityStandardized>('operation'),
    ]);

    // Make sure operations are sorted by timestamp desc
    // and that we don't have duplicates
    const operations = [
        ...newOrScheduledOperations,
        ...completedOperationsFuture,
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Remove duplicates
    const uniqueOperations = Array.from(
        new Map(operations.map((op) => [op.id, op])).values(),
    );

    return (
        <ScheduleClient
            allRaisedBeds={allRaisedBeds}
            operations={uniqueOperations}
            plantSorts={plantSorts}
            operationsData={operationsData}
            userId={userId}
        />
    );
}
