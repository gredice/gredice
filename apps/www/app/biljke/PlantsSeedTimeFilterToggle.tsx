'use client';

import { useSearchParam } from '@signalco/hooks/useSearchParam';
import { ThumbsUp } from '@signalco/ui-icons';
import { Chip } from '@signalco/ui-primitives/Chip';
import { cx } from '@signalco/ui-primitives/cx';

const filterParamName = 'vrijemeZaSijanje';

export function PlantsSeedTimeFilterToggle() {
    const [seedTimeFilter, setSeedTimeFilter] = useSearchParam(filterParamName);
    const isEnabled = seedTimeFilter === '1';

    return (
        <button
            type="button"
            onClick={() => setSeedTimeFilter(isEnabled ? '' : '1')}
            aria-pressed={isEnabled}
        >
            <Chip
                size="sm"
                color="success"
                className={cx(
                    'cursor-pointer transition-opacity',
                    !isEnabled && 'opacity-60 hover:opacity-90',
                )}
            >
                <ThumbsUp className="size-3 shrink-0" />
                <span>Vrijeme za sijanje</span>
            </Chip>
        </button>
    );
}
