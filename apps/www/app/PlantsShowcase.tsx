import { Navigate } from '@gredice/ui/icons';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { cx } from '@gredice/ui/utils';
import Link from 'next/link';
import { KnownPages } from '../src/KnownPages';
import { PlantsGalleryItem } from './biljke/PlantsGalleryItem';
import type { PlantCatalogueItem } from './biljke/plantCatalogue';
import { formatPlantCount } from './biljke/plantSeason';

/** Plant cards stay ~234px+ wide (as in the archive) so their facts never overlap. */
const gridClassName =
    'grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
/** Rows stay full: the fourth plant shows only where it completes a row. */
const fourthPlantClassName = 'hidden md:block lg:hidden xl:block';
/** At md the tile closes the second row by spanning two columns. */
const allPlantsTileClassName = 'md:col-span-2 lg:col-span-1';
/** One row of six when the tile is wide and short, a 3×4 mosaic when tall, 6×2 when spanning. */
const previewGridClassName =
    'grid grid-cols-6 gap-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-3';

export function PlantsShowcase({
    plants,
    previewPlants,
    totalPlants,
    currentMonth,
}: {
    plants: PlantCatalogueItem[];
    previewPlants: PlantCatalogueItem[];
    totalPlants: number;
    currentMonth: number;
}) {
    return (
        <div className={gridClassName}>
            {plants.map((plant, plantIndex) => (
                <div
                    key={plant.id}
                    className={cx(plantIndex === 3 && fourthPlantClassName)}
                >
                    <PlantsGalleryItem
                        key={plant.information.name}
                        {...plant}
                        id={plant.id.toString()}
                        currentMonth={currentMonth}
                        mediaClassName="aspect-[16/9] sm:aspect-square"
                    />
                </div>
            ))}
            <Link
                href={KnownPages.Plants}
                className={cx(
                    'group/all-plants flex flex-col justify-between gap-6 rounded-lg border border-brand/30 border-b-4 bg-brand/10 p-4 transition-colors hover:border-brand/60 hover:bg-brand/15 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:p-5',
                    allPlantsTileClassName,
                )}
            >
                <div aria-hidden className={previewGridClassName}>
                    {previewPlants.map((plant, previewIndex) => (
                        <div
                            key={plant.id}
                            className={cx(
                                'relative aspect-square rounded-xl bg-card/80 shadow-xs transition-transform group-hover/all-plants:scale-[1.03] motion-reduce:transition-none',
                                previewIndex >= 6 && 'hidden sm:block',
                            )}
                        >
                            <PlantOrSortImage
                                plant={plant}
                                alt=""
                                fill
                                className="object-contain p-1.5"
                                sizes="96px"
                            />
                        </div>
                    ))}
                </div>
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <span className="font-[family-name:var(--font-montserrat)] text-xl">
                            Sve biljke
                        </span>
                        <span className="text-sm text-secondary-foreground">
                            {formatPlantCount(totalPlants)} za tvoju gredicu
                        </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand">
                        Pogledaj katalog
                        <Navigate
                            aria-hidden
                            className="size-4 shrink-0 transition-transform group-hover/all-plants:translate-x-0.5 motion-reduce:transition-none"
                        />
                    </span>
                </div>
            </Link>
        </div>
    );
}
