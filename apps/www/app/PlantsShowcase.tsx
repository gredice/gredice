import { Navigate } from '@gredice/ui/icons';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Row } from '@gredice/ui/Row';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import Link from 'next/link';
import { getPlantsData } from '../lib/plants/getPlantsData';
import { KnownPages } from '../src/KnownPages';
import { PlantsGalleryItem } from './biljke/PlantsGalleryItem';
import { toPlantCard, toPlantCatalogue } from './biljke/plantCatalogue';

// The plant cards carry a season strip and facts row, so fewer, wider cards
// read better: 2×2 on phones, two cards and the tile on tablets, three and
// the tile from lg up.
const shownPlants = 3;
// Four columns inside the 1280px container make each card ~300px wide.
const showcaseImageSizes =
    '(min-width: 1280px) 300px, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw';

export async function PlantsShowcase() {
    const entities = await getPlantsData();
    const plants = entities
        ?.slice()
        ?.sort(
            (first, second) =>
                Number(second.isRecommended) - Number(first.isRecommended),
        )
        ?.slice(0, shownPlants);
    const extraPlants = entities
        ?.filter((plant) => !plants?.some((entry) => entry.id === plant.id))
        ?.slice(0, 24);
    const currentMonth = new Date().getMonth() + 1;

    return (
        <div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {toPlantCatalogue(plants ?? [], []).map((plant, plantIndex) => (
                    <div
                        key={plant.id}
                        className={cx(plantIndex === 2 && 'md:hidden lg:block')}
                    >
                        <PlantsGalleryItem
                            key={plant.information.name}
                            {...plant}
                            id={plant.id.toString()}
                            currentMonth={currentMonth}
                            imageSizes={showcaseImageSizes}
                        />
                    </div>
                ))}
                <Link
                    href={KnownPages.Plants}
                    className="relative flex flex-col justify-center items-center overflow-hidden hover:border-muted-foreground/50 hover:bg-card/30 bg-card/70 rounded-lg border border-tertiary border-dashed p-4 transition-all"
                >
                    <div
                        className="absolute inset-0 grid grid-cols-4 gap-2 p-2 opacity-50"
                        aria-hidden="true"
                    >
                        {extraPlants?.map((plant) => (
                            <div
                                key={plant.id}
                                className="relative aspect-square"
                            >
                                <PlantOrSortImage
                                    plant={toPlantCard(plant)}
                                    alt={plant.information.name ?? 'Biljka'}
                                    fill
                                    className="object-contain"
                                    sizes="60px"
                                />
                            </div>
                        ))}
                    </div>
                    <div className="absolute inset-0 bg-card/60" />
                    <Row spacing={2} className="relative z-10">
                        <Typography level="body1">Sve biljke</Typography>
                        <Navigate className="size-5 shrink-0" />
                    </Row>
                </Link>
            </div>
        </div>
    );
}
