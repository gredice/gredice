import type { RaisedBedPlantingReadModel } from '@gredice/js/plants';
import { Chip } from '../Chip';
import { LocalDateTime } from '../LocalDateTime';
import { Stack } from '../Stack';
import { Typography } from '../Typography';

export type RaisedBedPlantingReadOnlyItem = RaisedBedPlantingReadModel & {
    plantName: string;
};

function plantCountLabel(plantCount: number) {
    if (plantCount === 1) {
        return '1 biljka';
    }
    if (plantCount >= 2 && plantCount <= 4) {
        return `${plantCount.toString()} biljke`;
    }

    return `${plantCount.toString()} biljaka`;
}

function fieldPositionsLabel(positionNumbers: number[]) {
    if (positionNumbers.length === 0) {
        return 'Nije zabilježeno';
    }

    return positionNumbers.join(', ');
}

export function RaisedBedPlantingsReadOnly({
    items,
}: {
    items: readonly RaisedBedPlantingReadOnlyItem[];
}) {
    if (items.length === 0) {
        return (
            <Typography level="body2" className="text-muted-foreground">
                Nema zabilježenih sadnji.
            </Typography>
        );
    }

    return (
        <Stack spacing={3}>
            <Typography level="body3" className="text-muted-foreground">
                Svaki zapis predstavlja jednu logičku sadnju. Razmak, gustoća i
                otisak prikazuju spremljene vrijednosti sadnje, bez ponovnog
                izračuna iz trenutačnog kataloga.
            </Typography>
            <ul className="divide-y rounded-md border">
                {items.map((item) => (
                    <li
                        className="space-y-3 px-3 py-3 sm:px-4"
                        data-raised-bed-planting-id={item.id}
                        key={item.id}
                    >
                        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                            <Typography
                                component="h3"
                                level="body2"
                                semiBold
                                className="min-w-0 break-words"
                            >
                                {item.plantName}
                            </Typography>
                            <Chip
                                color={item.isActive ? 'success' : 'neutral'}
                                size="sm"
                                variant="soft"
                            >
                                {item.isActive ? 'Aktivno' : 'Završeno'}
                            </Chip>
                        </div>

                        {item.layoutStatus === 'selected' ? (
                            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
                                <div>
                                    <dt className="text-xs font-medium text-muted-foreground">
                                        Odabrani razmak
                                    </dt>
                                    <dd>
                                        {item.selectedSeedingDistanceCm?.toString()}{' '}
                                        cm
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-muted-foreground">
                                        Gustoća i broj
                                    </dt>
                                    <dd>
                                        {item.plantsPerAxis?.toString()} ×{' '}
                                        {item.plantsPerAxis?.toString()} (
                                        {plantCountLabel(item.plantCount ?? 0)})
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-muted-foreground">
                                        Otisak
                                    </dt>
                                    <dd>
                                        {item.spanRows?.toString()} ×{' '}
                                        {item.spanColumns?.toString()} polja
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-muted-foreground">
                                        Pozicije polja
                                    </dt>
                                    <dd>
                                        {fieldPositionsLabel(
                                            item.positionNumbers,
                                        )}
                                    </dd>
                                </div>
                            </dl>
                        ) : (
                            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950 text-sm dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                                {item.layoutStatus === 'legacy-unknown'
                                    ? 'Naslijeđena sadnja: raspored, gustoća i broj biljaka nisu zabilježeni.'
                                    : 'Odabrana sadnja nema cjelovit spremljeni raspored. Potrebna je provjera podataka.'}
                                {item.positionNumbers.length > 0
                                    ? ` Povezana polja: ${fieldPositionsLabel(item.positionNumbers)}.`
                                    : ''}
                            </div>
                        )}

                        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                            <div>
                                <dt className="text-xs font-medium text-muted-foreground">
                                    Početak životnog ciklusa
                                </dt>
                                <dd>
                                    <LocalDateTime>
                                        {item.lifecycleStartedAt}
                                    </LocalDateTime>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium text-muted-foreground">
                                    Završetak životnog ciklusa
                                </dt>
                                <dd>
                                    {item.lifecycleStoppedAt ? (
                                        <LocalDateTime>
                                            {item.lifecycleStoppedAt}
                                        </LocalDateTime>
                                    ) : item.isActive ? (
                                        'U tijeku'
                                    ) : (
                                        'Nije zabilježeno'
                                    )}
                                </dd>
                            </div>
                        </dl>
                    </li>
                ))}
            </ul>
        </Stack>
    );
}
