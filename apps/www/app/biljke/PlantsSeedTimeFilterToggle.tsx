'use client';

import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { useClientSearchParam } from '../../hooks/useClientSearchParam';

const filterParamName = 'vrijemeZaSijanje';

export function PlantsSeedTimeFilterToggle({
    initialValue = '',
}: {
    initialValue?: string;
}) {
    const [seedTimeFilter, setSeedTimeFilter] = useClientSearchParam(
        filterParamName,
        initialValue,
    );
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
