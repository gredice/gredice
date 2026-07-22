import {
    addCalendarDays,
    getAttributeDefinitions,
    getEntitiesRaw,
    getEntityTypes,
    getIncompleteEntityCountsByState,
    getSunflowersDailyTotals,
    getUserRegistrationsByWeekday,
} from '@gredice/storage';
import { getAnalyticsData } from '../../../components/admin/dashboard/actions';

const weekdayLabels = [
    'Nedjelja',
    'Ponedjeljak',
    'Utorak',
    'Srijeda',
    'Četvrtak',
    'Petak',
    'Subota',
] as const;
const statisticsTimeZone = 'Europe/Zagreb';

type BoundedStatisticsPeriod = {
    fromDate: Date;
    toDate: Date;
    pickerFrom: string;
    pickerTo: string;
};

export async function getUserStatisticsData({
    fromDate,
    toDate,
}: BoundedStatisticsPeriod) {
    const counts = await getUserRegistrationsByWeekday(
        fromDate,
        toDate,
        statisticsTimeZone,
    );

    return weekdayLabels.map((label, index) => ({
        label,
        count: counts[index] ?? 0,
    }));
}

export async function getOperationsStatisticsData({
    pickerFrom,
    pickerTo,
}: BoundedStatisticsPeriod) {
    const data = await getAnalyticsData(undefined, pickerFrom, pickerTo);
    return data.operationsDuration;
}

export async function getRecordsStatisticsData() {
    const entityTypes = await getEntityTypes();

    return Promise.all(
        entityTypes.map(async (entityType) => {
            const [entities, definitions] = await Promise.all([
                getEntitiesRaw(entityType.name),
                getAttributeDefinitions(entityType.name),
            ]);
            const incompleteCounts = getIncompleteEntityCountsByState(
                entities,
                definitions,
            );

            return {
                entityTypeName: entityType.name,
                label: entityType.label,
                count: entities.length,
                incompleteDraftCount: incompleteCounts.draft,
                incompletePublishedCount: incompleteCounts.published,
            };
        }),
    );
}

export async function getSunflowersStatisticsData({
    fromDate,
    toDate,
    pickerFrom,
    pickerTo,
}: BoundedStatisticsPeriod) {
    const rawTotals = await getSunflowersDailyTotals({
        from: fromDate,
        to: toDate,
        timeZone: statisticsTimeZone,
    });
    const totalsByDate = new Map(rawTotals.map((item) => [item.date, item]));
    const dailyTotals = [];

    for (
        let date = pickerFrom;
        date <= pickerTo;
        date = addCalendarDays(date, 1)
    ) {
        const totals = totalsByDate.get(date);
        dailyTotals.push({
            date,
            spent: totals?.spent ?? 0,
            earned: totals?.earned ?? 0,
        });
    }

    return dailyTotals;
}
