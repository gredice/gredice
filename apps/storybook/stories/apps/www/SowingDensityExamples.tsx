import { AttributeCard } from '@apps/www/components/attributes/DetailCard';
import { PlantGridIcon } from '@gredice/ui/GridIcons';
import { SowingDensityConceptIcon } from './SowingDensityConceptIcon';

const densities: ReadonlyArray<1 | 4 | 9 | 16> = [1, 4, 9, 16];

export function SowingDensityExamples() {
    return (
        <section aria-label="Sowing density proposal" className="space-y-4">
            <h2 className="text-xl font-semibold">
                Gustoća sijanja · prijedlog
            </h2>
            <p className="max-w-3xl text-secondary-foreground">
                Pogled odozgo čuva jasan raspored. Svako zeleno mjesto
                predstavlja jednu biljku, a točan broj ostaje ispisan uz ikonu.
                Ista podloga za sve gustoće: 1, 4, 9 i 16 mjesta po polju.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {densities.map((totalPlants) => (
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
                                <PlantGridIcon
                                    totalPlants={totalPlants}
                                    className="size-8"
                                />
                                <figcaption className="text-xs">
                                    Sada
                                </figcaption>
                            </figure>
                            <figure className="flex flex-col items-center gap-2">
                                <SowingDensityConceptIcon
                                    totalPlants={totalPlants}
                                    width={64}
                                    height={64}
                                    aria-hidden
                                />
                                <figcaption className="text-xs">
                                    Mjesta · preporuka
                                </figcaption>
                            </figure>
                        </div>
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            {[24, 32, 48].map((size) => (
                                <figure
                                    key={size}
                                    className="flex flex-col items-center gap-2"
                                >
                                    <SowingDensityConceptIcon
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
                ))}
            </div>
            <h3 className="text-lg font-semibold">U kartici · 24px</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {densities.map((totalPlants) => (
                    <AttributeCard
                        key={totalPlants}
                        icon={
                            <SowingDensityConceptIcon
                                totalPlants={totalPlants}
                                aria-hidden
                            />
                        }
                        header="Broj biljaka na 30x30 cm"
                        value={totalPlants}
                    />
                ))}
            </div>
            <h3 className="text-lg font-semibold">
                Alternativa · male sadnice
            </h3>
            <p className="text-sm text-secondary-foreground">
                Više detalja na većim prikazima; na 24px je teže razlikovati
                gustoće.
            </p>
            <div className="flex flex-wrap gap-6">
                {densities.map((totalPlants) => (
                    <figure key={totalPlants} className="space-y-2">
                        <div className="flex items-end gap-3">
                            {[24, 64].map((size) => (
                                <SowingDensityConceptIcon
                                    key={size}
                                    totalPlants={totalPlants}
                                    treatment="seedlings"
                                    width={size}
                                    height={size}
                                    aria-hidden
                                />
                            ))}
                        </div>
                        <figcaption className="text-xs">
                            {totalPlants} · 24 / 64px
                        </figcaption>
                    </figure>
                ))}
            </div>
        </section>
    );
}
