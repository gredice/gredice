'use client';

import { useSearchParam } from '@signalco/hooks/useSearchParam';
import { ThumbsUp } from '@signalco/ui-icons';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Row } from '@signalco/ui-primitives/Row';

const filterParamName = 'vrijemeZaSijanje';

export function PlantsSeedTimeFilterToggle() {
    const [seedTimeFilter, setSeedTimeFilter] = useSearchParam(filterParamName);
    const isEnabled = seedTimeFilter === '1';

    return (
        <Row spacing={2} className="items-center">
            <Chip size="sm" color="success" className="cursor-default">
                <ThumbsUp className="size-3 shrink-0" />
                <span>Vrijeme za sijanje</span>
            </Chip>
            <Checkbox
                aria-label="Uključi filter vrijeme za sijanje"
                disableIcon
                checked={isEnabled}
                onCheckedChange={(checked) =>
                    setSeedTimeFilter(checked === true ? '1' : '')
                }
                className="relative h-6 w-11 rounded-full border-none bg-neutral-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:content-[''] data-[state=checked]:bg-lime-500 data-[state=checked]:after:translate-x-5"
            />
        </Row>
    );
}
