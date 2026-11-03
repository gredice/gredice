'use client';

import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { Close } from '@gredice/ui/icons';
import { calendarMonthLocativeNames } from '../../lib/plants/calendarActivities';
import {
    type PlantArchiveFilterDefaults,
    usePlantArchiveFilters,
} from './usePlantArchiveFilters';

/** Shown only while a month filter is active, so there is no empty row otherwise. */
export function PlantsActiveFilters({
    filters,
}: {
    filters: PlantArchiveFilterDefaults;
}) {
    const { activity, clearFilters, month, search, setMonthFilter } =
        usePlantArchiveFilters(filters);
    if (!month) {
        return null;
    }

    const label = `${activity === 'berba' ? 'Berba' : 'Sijanje'} u ${calendarMonthLocativeNames[month - 1] ?? ''}`;
    return (
        <div className="flex flex-wrap items-center gap-2">
            <Chip
                variant="outlined"
                onClick={() => setMonthFilter(null)}
                aria-label={`Ukloni filter: ${label}`}
            >
                {label}
                <Close aria-hidden className="size-3.5" />
            </Chip>
            {search && (
                <Button variant="link" size="sm" onClick={clearFilters}>
                    Očisti sve
                </Button>
            )}
        </div>
    );
}
