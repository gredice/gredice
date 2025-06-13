import { Card } from "@signalco/ui-primitives/Card";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Stack } from "@signalco/ui-primitives/Stack";
import { KnownPages } from "../../../src/KnownPages";
import { getPlantSortsData } from "../../../lib/plants/getPlantSortsData";
import { Suspense } from "react";
import { Row } from "@signalco/ui-primitives/Row";
import { PlantImage } from "../../../components/plants/PlantImage";
import { slug } from "@signalco/js";

async function PlantSortsListContent({ basePlantName }: { basePlantName: string }) {
    const allSorts = await getPlantSortsData();
    const sorts = (allSorts
        ?.filter(sort => sort.information.plant.information?.name?.toLowerCase() === basePlantName.toLowerCase()) ?? [])
        .sort((a, b) => a.information.name.localeCompare(b.information.name));
    if (!sorts.length) {
        return (
            <Stack spacing={2}>
                <Typography level="h2" className="text-2xl">Sorte</Typography>
                <Typography level="body2" className="text-gray-500 italic">Nema dostupnih sorti</Typography>
            </Stack>
        );
    }
    return (
        <Stack spacing={2}>
            <Typography level="h2" className="text-2xl" id={slug("Sorte")}>Sorte</Typography>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {sorts.map(sort => (
                    <Card key={sort.id} href={KnownPages.PlantSort(basePlantName, sort.information.name)}>
                        <Row spacing={2}>
                            <PlantImage
                                plant={{
                                    image: {
                                        cover: sort.image?.cover ?? sort.information.plant.image?.cover
                                    },
                                    information: {
                                        name: sort.information.name
                                    }
                                }}
                                width={72}
                                height={72} />
                            <Stack>
                                <Typography level="h5">{sort.information.name}</Typography>
                                {sort.information.shortDescription && <Typography level="body1">{sort.information.shortDescription}</Typography>}
                            </Stack>
                        </Row>
                    </Card>
                ))}
            </div>
        </Stack>
    );
}

export function PlantSortsList({ basePlantName }: { basePlantName: string }) {
    return (
        <Suspense fallback={<Typography level="body2">Učitavanje sorti...</Typography>}>
            <PlantSortsListContent basePlantName={basePlantName} />
        </Suspense>
    );
}
