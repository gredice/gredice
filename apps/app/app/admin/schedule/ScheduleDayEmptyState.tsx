import { Typography } from '@gredice/ui/Typography';
import { getScheduleDayData } from './scheduleData';

interface ScheduleDayEmptyStateProps {
    isToday: boolean;
    date: Date;
}

export async function ScheduleDayEmptyState({
    isToday,
    date,
}: ScheduleDayEmptyStateProps) {
    const { scheduledFields, scheduledOperations, todaysDeliveryRequests } =
        await getScheduleDayData(date, isToday);

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
