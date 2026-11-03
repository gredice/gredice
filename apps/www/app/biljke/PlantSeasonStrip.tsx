import {
    calendarMonthNames,
    calendarMonthShortNames,
} from '../../lib/plants/calendarActivities';
import type { PlantCatalogueItem } from './plantCatalogue';
import {
    isPlantHarvestedInMonth,
    isPlantSowableInMonth,
    plantArchiveMonths,
} from './plantSeason';

// Child cells carry only data attributes; the lane styles them, which keeps
// 49+ cards × 24 cells light in the server-rendered HTML.
const laneClassName =
    'grid grid-cols-12 gap-0.5 [&>span]:h-2 [&>span]:rounded-xs [&>span]:bg-muted [&>[data-current]]:ring-1 [&>[data-current]]:ring-foreground';

function monthList(active: boolean[]) {
    const names = plantArchiveMonths
        .filter((_, index) => active[index])
        .map((month) => calendarMonthNames[month - 1]?.toLowerCase());
    return names.length ? names.join(', ') : 'nema';
}

export function PlantSeasonStrip({
    currentMonth,
    plant,
}: {
    currentMonth: number;
    plant: Pick<PlantCatalogueItem, 'calendar'>;
}) {
    const sowing = plantArchiveMonths.map((month) =>
        isPlantSowableInMonth(plant, month),
    );
    const harvest = plantArchiveMonths.map((month) =>
        isPlantHarvestedInMonth(plant, month),
    );

    return (
        <div
            role="img"
            aria-label={`Sijanje: ${monthList(sowing)}. Berba: ${monthList(harvest)}.`}
            className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1"
        >
            <span className="text-[11px] leading-none text-tertiary-foreground">
                Sijanje
            </span>
            <span
                className={`${laneClassName} [&>[data-active]]:bg-yellow-400`}
            >
                {plantArchiveMonths.map((month, index) => (
                    <span
                        key={month}
                        data-active={sowing[index] || undefined}
                        data-current={month === currentMonth || undefined}
                    />
                ))}
            </span>
            <span className="text-[11px] leading-none text-tertiary-foreground">
                Berba
            </span>
            <span className={`${laneClassName} [&>[data-active]]:bg-lime-400`}>
                {plantArchiveMonths.map((month, index) => (
                    <span
                        key={month}
                        data-active={harvest[index] || undefined}
                        data-current={month === currentMonth || undefined}
                    />
                ))}
            </span>
            <span />
            <span className="grid grid-cols-12 gap-0.5 text-center text-[10px] leading-none text-tertiary-foreground [&>[data-current]]:font-bold [&>[data-current]]:text-foreground">
                {calendarMonthShortNames.map((name, index) => (
                    <span
                        key={name}
                        data-current={index + 1 === currentMonth || undefined}
                    >
                        {name.charAt(0)}
                    </span>
                ))}
            </span>
        </div>
    );
}
