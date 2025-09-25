import { Navigate } from '@signalco/ui-icons';
import { cx } from '@signalco/ui-primitives/cx';
import { Row } from '@signalco/ui-primitives/Row';
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
                    className="flex flex-col justify-center items-center hover:border-muted-foreground/50 hover:bg-white/30 bg-white/70 rounded-lg border border-dashed p-4 transition-all"
                >
                    <Row spacing={1}>
                        <span>Sve biljke</span>
                        <Navigate className="size-5 shrink-0" />
                    </Row>
                </Link>
            </div>
        </div>
    );
}
