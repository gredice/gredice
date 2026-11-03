import { calculatePlantsPerField, FIELD_SIZE_LABEL } from '@gredice/js/plants';
import { PlantGridIcon } from '@gredice/ui/GridIcons';
import { PlantYieldTooltip } from '@gredice/ui/plants';
import type { PlantCatalogueItem } from './plantCatalogue';

/** Fixed three-cell row so card facts never wrap differently card to card. */
export function PlantCardFacts({
    plant,
}: {
    plant: Pick<PlantCatalogueItem, 'information' | 'attributes'>;
}) {
    const { information, attributes } = plant;
    const { totalPlants } = calculatePlantsPerField(
        attributes?.seedingDistance,
        information.name,
    );
    const growthMin = attributes?.growthWindowMin;
    const growthMax = attributes?.growthWindowMax;
    const growth =
        growthMin && growthMax
            ? `${growthMin}–${growthMax} d`
            : growthMin || growthMax
              ? `${growthMin ?? growthMax} d`
              : '—';

    return (
        <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.3fr)] rounded-md bg-background/70 py-1.5 text-center">
            <div
                title={`Očekivani prinos po polju ${FIELD_SIZE_LABEL}`}
                className="flex min-w-0 flex-col items-center gap-0.5"
            >
                <dt className="text-[11px] text-tertiary-foreground">Prinos</dt>
                <dd className="text-xs font-semibold whitespace-nowrap sm:text-sm">
                    <PlantYieldTooltip plant={{ information, attributes }} />
                </dd>
            </div>
            <div
                title={`Broj biljaka po polju ${FIELD_SIZE_LABEL}`}
                className="flex min-w-0 flex-col items-center gap-0.5 border-l"
            >
                <dt className="text-[11px] text-tertiary-foreground">
                    Biljaka
                </dt>
                <dd className="inline-flex items-center gap-1 text-xs font-semibold sm:text-sm">
                    <PlantGridIcon
                        totalPlants={totalPlants}
                        className="size-5 shrink-0"
                    />
                    {totalPlants}
                </dd>
            </div>
            <div
                title="Vrijeme rasta"
                className="flex min-w-0 flex-col items-center gap-0.5 border-l"
            >
                <dt className="text-[11px] text-tertiary-foreground">Rast</dt>
                <dd className="text-xs font-semibold whitespace-nowrap sm:text-sm">
                    {growth}
                </dd>
            </div>
        </dl>
    );
}
