'use client';

import { useClientSearchParam } from '../../hooks/useClientSearchParam';
import {
    type PlantSeasonActivity,
    parsePlantArchiveMonth,
    parsePlantSeasonActivity,
} from './plantSeason';

export type PlantArchiveFilterDefaults = {
    currentMonth: number;
    initialActivity: string;
    initialMonth: string;
    initialSearch: string;
    /** Legacy `vrijemeZaSijanje=1` links mean "sowable this month". */
    initialSeedTimeFilter: string;
};

/** URL-backed archive filters shared by the header, toolbar and both views. */
export function usePlantArchiveFilters({
    currentMonth,
    initialActivity,
    initialMonth,
    initialSearch,
    initialSeedTimeFilter,
}: PlantArchiveFilterDefaults) {
    const [search, setSearch] = useClientSearchParam('pretraga', initialSearch);
    const [monthParam, setMonthParam] = useClientSearchParam(
        'mjesec',
        initialMonth,
    );
    const [activityParam, setActivityParam] = useClientSearchParam(
        'aktivnost',
        initialActivity,
    );
    const [seedTimeParam, setSeedTimeParam] = useClientSearchParam(
        'vrijemeZaSijanje',
        initialSeedTimeFilter,
    );

    const isLegacySeedTimeFilter = seedTimeParam === '1';
    const month =
        parsePlantArchiveMonth(monthParam) ??
        (isLegacySeedTimeFilter ? currentMonth : null);
    const activity = parsePlantSeasonActivity(activityParam);

    const setMonthFilter = (nextMonth: number | null) => {
        setSeedTimeParam('');
        setMonthParam(nextMonth ? nextMonth.toString() : '');
    };

    const setActivity = (nextActivity: PlantSeasonActivity) => {
        if (isLegacySeedTimeFilter) {
            setMonthFilter(month);
        }
        setActivityParam(nextActivity === 'berba' ? 'berba' : '');
    };

    const showSeason = (
        nextActivity: PlantSeasonActivity,
        nextMonth: number,
    ) => {
        setSearch('');
        setActivityParam(nextActivity === 'berba' ? 'berba' : '');
        setMonthFilter(nextMonth);
    };

    const clearFilters = () => {
        setSearch('');
        setMonthFilter(null);
    };

    return {
        activity,
        clearFilters,
        month,
        search,
        setActivity,
        setMonthFilter,
        setSearch,
        showSeason,
    };
}
