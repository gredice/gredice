import { Typography } from '@signalco/ui-primitives/Typography';
import {
    getScheduleDeliveryRequests,
    getScheduleOperations,
    getScheduleRaisedBeds,
} from './scheduleData';
import {
    getDayDeliveryRequests,
    getScheduledFieldsForDay,
    getScheduledOperationsForDay,
} from './scheduleDayFilters';

interface ScheduleDayEmptyStateProps {
    isToday: boolean;
    date: Date;
}

export async function ScheduleDayEmptyState({
    isToday,
    date,
}: ScheduleDayEmptyStateProps) {
    const [raisedBeds, operations, deliveryRequests] = await Promise.all([
        getScheduleRaisedBeds(),
        getScheduleOperations(),
        getScheduleDeliveryRequests(),
    ]);

    const scheduledFields = getScheduledFieldsForDay(isToday, date, raisedBeds);
    const scheduledOperations = getScheduledOperationsForDay(
        isToday,
        date,
        operations,
    );
    const todaysDeliveryRequests = getDayDeliveryRequests(
        isToday,
        date,
        deliveryRequests,
    );

    if (
        scheduledFields.length +
            scheduledOperations.length +
            todaysDeliveryRequests.length >
        0
    ) {
        return null;
    }

    return (
        <Typography level="body2" className="leading-[56px]">
            Trenutno nema zadataka za ovaj dan.
        </Typography>
    );
}
