import { PlantOrSortImage } from '@gredice/ui/plants';
import { Navigate } from '@signalco/ui-icons';
import { cx } from '@signalco/ui-primitives/cx';
import { Row } from '@signalco/ui-primitives/Row';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { getPlantsData } from '../lib/plants/getPlantsData';
import { KnownPages } from '../src/KnownPages';
import { PlantsGalleryItem } from './biljke/PlantsGalleryItem';

export async function PlantsShowcase() {
    const entities = await getPlantsData();
    const plants = entities
        ?.slice()
        ?.sort(
            (first, second) =>
                Number(second.isRecommended) - Number(first.isRecommended),
        )
        ?.slice(0, 4);
    const extraPlants = entities
        ?.filter((plant) => !plants?.some((entry) => entry.id === plant.id))
        ?.slice(0, 24);

    return (
        <div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {plants?.map((plant, plantIndex) => (
                    <div
                        key={plant.id}
                        className={cx(
                            plantIndex === 3 &&
                                'hidden sm:block md:hidden lg:block',
                        )}
                    >
                        <PlantsGalleryItem
                            key={plant.information.name}
                            information={plant.information}
                            attributes={plant.attributes}
                            image={plant.image}
                            prices={plant.prices}
                            isRecommended={plant.isRecommended}
                        />
                    </div>
                ))}
                <Link
                    href={KnownPages.Plants}
                    className="relative flex flex-col justify-center items-center overflow-hidden hover:border-muted-foreground/50 hover:bg-card/30 bg-card/70 rounded-lg border border-tertiary border-dashed p-4 transition-all"
                >
                    <div className="absolute inset-0 grid grid-cols-4 gap-2 p-2 opacity-50">
                        {extraPlants?.map((plant) => (
                            <div
                                key={plant.id}
                                className="relative aspect-square"
                            >
                                <PlantOrSortImage
                                    plant={plant}
                                    fill
                                    className="object-contain"
                                    sizes="60px"
                                />
                            </div>
                        ))}
                    </div>
                    <div className="absolute inset-0 bg-card/60" />
                    <Row spacing={1} className="relative z-10">
                        <Typography level="body1">Sve biljke</Typography>
                        <Navigate className="size-5 shrink-0" />
                    </Row>
                </Link>
            </div>
        </div>
    );
}
