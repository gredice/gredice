import { AiWatermark } from '@gredice/ui/AiWatermark';
import { slug } from '@signalco/js';
import { Card } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { Suspense } from 'react';
import { PlantImage } from '../../../components/plants/PlantImage';
import { getPlantSortsData } from '../../../lib/plants/getPlantSortsData';
import { KnownPages } from '../../../src/KnownPages';

async function PlantSortsListContent({
    basePlantName,
}: {
    basePlantName: string;
}) {
    const allSorts = await getPlantSortsData();
    const sorts = (
        allSorts?.filter(
            (sort) =>
                sort.information.plant.information?.name?.toLowerCase() ===
                basePlantName.toLowerCase(),
        ) ?? []
    ).sort((a, b) => a.information.name.localeCompare(b.information.name));
    if (!sorts.length) {
        return (
            <Stack spacing={2}>
                <Typography level="h2" className="text-2xl">
                    Sorte
                </Typography>
                <Typography level="body2" className="text-gray-500 italic">
                    Nema dostupnih sorti
                </Typography>
            </Stack>
        );
    }
    return (
        <Stack spacing={2}>
            <Typography level="h2" className="text-2xl" id={slug('Sorte')}>
                Sorte
            </Typography>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {sorts.map((sort) => {
                    const isAvailable =
                        sort.store?.availableInStore ??
                        sort.information.plant.store?.availableInStore ??
                        false;

                    return (
                        <Card
                            key={sort.id}
                            href={KnownPages.PlantSort(
                                basePlantName,
                                sort.information.name,
                            )}
                            className="border-tertiary border-b-4"
                        >
                            <Row spacing={2}>
                                <AiWatermark
                                    className="size-20 aspect-square"
                                    reason="Primjer ploda biljke visoke rezolucije bez nedostataka."
                                    aiPrompt={`Realistic and not perfect image of requested plant on white background. No Text Or Banners. Square image. ${sort.information.plant.information?.name}`}
                                    aiModel="ChatGPT-4o"
                                >
                                    <PlantImage
                                        plant={{
                                            image: {
                                                cover:
                                                    sort.image?.cover ??
                                                    sort.information.plant.image
                                                        ?.cover,
                                            },
                                            information: {
                                                name: sort.information.name,
                                            },
                                        }}
                                        width={72}
                                        height={72}
                                    />
                                </AiWatermark>
                                <Stack className="grow">
                                    <Typography level="h5">
                                        {sort.information.name}
                                    </Typography>
                                    {sort.information.shortDescription && (
                                        <Typography level="body1">
                                            {sort.information.shortDescription}
                                        </Typography>
                                    )}
                                    {!isAvailable && (
                                        <Typography
                                            level="body2"
                                            className="text-amber-600 font-medium"
                                        >
                                            Trenutno nije dostupna u trgovini
                                        </Typography>
                                    )}
                                </Stack>
                            </Row>
                        </Card>
                    );
                })}
            </div>
        </Stack>
    );
}

export function PlantSortsList({ basePlantName }: { basePlantName: string }) {
    return (
        <Suspense
            fallback={
                <Typography level="body2">Učitavanje sorti...</Typography>
            }
        >
            <PlantSortsListContent basePlantName={basePlantName} />
        </Suspense>
    );
}
