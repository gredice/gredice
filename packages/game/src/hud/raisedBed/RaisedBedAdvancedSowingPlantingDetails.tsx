import { PlantGridIcon } from '@gredice/ui/GridIcons';
import { Typography } from '@gredice/ui/Typography';
import type { AdvancedSowingGardenPlantingVisual } from './advancedSowingGardenVisuals';

const plantCountPluralRules = new Intl.PluralRules('hr');

export function advancedSowingPlantingFieldsHeading(
    planting: AdvancedSowingGardenPlantingVisual,
) {
    const fields = planting.memberships
        .map((membership) => membership.positionIndex + 1)
        .sort((left, right) => left - right)
        .join(', ');
    return `${planting.memberships.length === 1 ? 'Polje' : 'Polja'} ${fields}`;
}

export function RaisedBedAdvancedSowingPlantingDetails({
    planting,
}: {
    planting: AdvancedSowingGardenPlantingVisual;
}) {
    const plural = plantCountPluralRules.select(planting.plantCount);
    const plantLabel =
        plural === 'one' ? 'biljka' : plural === 'few' ? 'biljke' : 'biljaka';
    const fieldCount = planting.memberships.length;
    return (
        <div
            className="flex flex-wrap items-center gap-x-6 gap-y-3"
            data-advanced-sowing-planting-id={planting.id}
        >
            <div className="flex items-center gap-2">
                <PlantGridIcon
                    aria-hidden="true"
                    className="size-7 shrink-0 text-emerald-700 dark:text-emerald-300"
                    data-advanced-sowing-density-icon
                    data-plant-count={planting.plantCount}
                    totalPlants={planting.plantCount}
                />
                <Typography level="body2" semiBold>
                    {planting.plantCount} {plantLabel}
                </Typography>
            </div>
            {fieldCount > 1 && (
                <div className="flex items-center gap-2">
                    <div
                        role="img"
                        aria-label={advancedSowingPlantingFieldsHeading(
                            planting,
                        )}
                        className="grid gap-0.5"
                        style={{
                            gridTemplateColumns: `repeat(${planting.spanColumns}, minmax(0, 1fr))`,
                            gridTemplateRows: `repeat(${planting.spanRows}, minmax(0, 1fr))`,
                        }}
                    >
                        {planting.memberships.map((membership) => (
                            <span
                                aria-hidden="true"
                                className="flex size-5 items-center justify-center rounded-xs border border-emerald-700/25 bg-emerald-50 text-[10px] font-semibold text-emerald-900 dark:border-emerald-300/30 dark:bg-emerald-950 dark:text-emerald-100"
                                key={membership.positionIndex}
                                style={{
                                    gridColumn: membership.relativeColumn + 1,
                                    gridRow: membership.relativeRow + 1,
                                }}
                            >
                                {membership.positionIndex + 1}
                            </span>
                        ))}
                    </div>
                    <Typography level="body2" secondary>
                        {fieldCount}{' '}
                        {plantCountPluralRules.select(fieldCount) === 'one'
                            ? 'polje'
                            : 'polja'}
                    </Typography>
                </div>
            )}
        </div>
    );
}
