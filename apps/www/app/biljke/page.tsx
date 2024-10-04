import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { getPlants } from "@gredice/storage";
import { Container } from "@signalco/ui-primitives/Container";
import { PlantsFilter } from "./PlantsFilter";
import { PlantsGallery } from "./PlantsGallery";

export const dynamic = 'force-dynamic';

export default async function PlantsPage() {
    const plants = await getPlants();

    return (
        <Container>
            <Stack>
                <div className="py-12 md:py-24 flex flex-col md:flex-row gap-4 justify-between">
                    <Stack spacing={1} className="max-w-96">
                        <Typography level="h2" component="h1">Biljke</Typography>
                        <Typography level="body1" secondary className="text-balance">Za tebe smo pripremili opširnu listu biljaka koje možeš pronaći u našem asortimanu.</Typography>
                    </Stack>
                    <PlantsFilter />
                </div>
                <PlantsGallery plants={plants} />
            </Stack>
        </Container>
    );
}