import { slug } from '@gredice/js/slug';
import { Card } from '@gredice/ui/Card';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { Suspense } from 'react';
import { getPlantSortsData } from '../../../lib/plants/getPlantSortsData';
import { KnownPages } from '../../../src/KnownPages';

async function PlantSortsListContent({
    basePlantName,
    basePlantId,
}: {
    basePlantName: string;
    basePlantId: number;
}) {
    const allSorts = await getPlantSortsData();
    const sorts = (
        allSorts?.filter(
            (sort) => sort.information.plant?.id === basePlantId,
        ) ?? []
    ).sort((a, b) => a.information.name.localeCompare(b.information.name));
    if (!sorts.length) {
        return (
            <Stack spacing={4}>
                <Typography level="h2" className="text-2xl" id={slug('Sorte')}>
                    Sorte
                </Typography>
                <Typography level="body2" className="text-gray-500 italic">
                    Nema dostupnih sorti
                </Typography>
            </Stack>
        );
    }
    return (
        <Stack spacing={4}>
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
                            <Row spacing={4}>
                                <PlantOrSortImage
                                    plantSort={sort}
                                    width={72}
                                    height={72}
                                />
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

export function PlantSortsList({
    basePlantName,
    basePlantId,
}: {
    basePlantName: string;
    basePlantId: number;
}) {
    return (
        <Suspense
            fallback={
                <Typography level="body2">Učitavanje sorti...</Typography>
            }
        >
            <PlantSortsListContent
                basePlantName={basePlantName}
                basePlantId={basePlantId}
            />
        </Suspense>
    );
}
