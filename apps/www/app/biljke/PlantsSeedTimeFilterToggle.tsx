'use client';

import { useSearchParam } from '@signalco/hooks/useSearchParam';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';

const filterParamName = 'vrijemeZaSijanje';

export function PlantsSeedTimeFilterToggle() {
    const [seedTimeFilter, setSeedTimeFilter] = useSearchParam(filterParamName);
    const isEnabled = seedTimeFilter === '1';

    return (
        <Checkbox
            aria-label="Uključi filter vrijeme za sijanje"
            checked={isEnabled}
            onCheckedChange={(checked: boolean | 'indeterminate') =>
                setSeedTimeFilter(checked === true ? '1' : '')
            }
            label='Samo "Vrijeme za sijanje"'
        />
    );
}
