import { Stack } from "@signalco/ui-primitives/Stack";
import { getEntitiesFormatted } from "@gredice/storage";
import { PlantsFilter } from "./PlantsFilter";
import { PlantsGallery } from "./PlantsGallery";
import { PlantData } from "./[plantId]/page";
import { PageHeader } from "../../components/shared/PageHeader";

export const dynamic = 'force-dynamic';

export default async function PlantsPage() {
    const entities = await getEntitiesFormatted<PlantData>('plant');
    return (
        <Stack>
            <PageHeader
                padded
                header="Biljke"
                subHeader="Za tebe smo pripremili opširnu listu biljaka koje možeš pronaći u našem asortimanu.">
                <PlantsFilter />
            </PageHeader>
            <PlantsGallery plants={entities} />
        </Stack>
    );
}