import { AttributeCard } from '@apps/www/components/attributes/DetailCard';
import {
    Grid1Icon,
    Grid4Icon,
    Grid9Icon,
    Grid16Icon,
    PlantGridIcon,
} from '@gredice/ui/GridIcons';

const densities = [1, 4, 9, 16, 25, 36];
const previousIcons = [
    Grid1Icon,
    Grid4Icon,
    Grid9Icon,
    Grid16Icon,
    Grid16Icon,
    Grid16Icon,
];

export function SowingDensityExamples() {
    return (
        <section aria-label="Sowing density" className="space-y-4">
            <h2 className="text-xl font-semibold">Gustoća sijanja</h2>
            <p className="max-w-3xl text-secondary-foreground">
                Pogled odozgo čuva jasan raspored. Svako zeleno mjesto
                predstavlja jednu biljku, a točan broj ostaje ispisan uz ikonu.
                Ista podloga za sve gustoće: 1, 4, 9, 16, 25 i 36 mjesta po
                polju. Mrkva, rotkvica i matovilac pri razmaku od 5 cm koriste
                36 mjesta.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {densities.map((totalPlants, index) => {
                    const PreviousIcon = previousIcons[index];
                    return (
                        <section
                            key={totalPlants}
                            aria-label={`Gustoća ${totalPlants}`}
                            className="space-y-4 rounded-xl border bg-card p-4"
                        >
                            <h3 className="font-semibold">
                                {totalPlants}{' '}
                                {totalPlants === 1
                                    ? 'biljka'
                                    : totalPlants === 4
                                      ? 'biljke'
                                      : 'biljaka'}
                            </h3>
                            <div className="flex items-end justify-between gap-4">
                                <figure className="flex flex-col items-center gap-2">
                                    <PreviousIcon className="size-8" />
                                    <figcaption className="text-xs">
                                        Prije · najviše 16
                                    </figcaption>
                                </figure>
                                <figure className="flex flex-col items-center gap-2">
                                    <PlantGridIcon
                                        totalPlants={totalPlants}
                                        width={64}
                                        height={64}
                                        aria-hidden
                                    />
                                    <figcaption className="text-xs">
                                        Točan raspored
                                    </figcaption>
                                </figure>
                            </div>
                            <div className="flex flex-wrap items-end justify-between gap-3">
                                {[24, 32, 48].map((size) => (
                                    <figure
                                        key={size}
                                        className="flex flex-col items-center gap-2"
                                    >
                                        <PlantGridIcon
                                            totalPlants={totalPlants}
                                            width={size}
                                            height={size}
                                            aria-hidden
                                        />
                                        <figcaption className="text-xs">
                                            {size}px
                                        </figcaption>
                                    </figure>
                                ))}
                            </div>
                        </section>
                    );
                })}
            </div>
            <h3 className="text-lg font-semibold">U kartici · 24px</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {densities.map((totalPlants) => (
                    <AttributeCard
                        key={totalPlants}
                        icon={
                            <PlantGridIcon
                                totalPlants={totalPlants}
                                aria-hidden
                            />
                        }
                        header="Broj biljaka na 30x30 cm"
                        value={totalPlants}
                    />
                ))}
            </div>
        </section>
    );
}
