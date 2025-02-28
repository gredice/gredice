import { Stack } from "@signalco/ui-primitives/Stack";
import { PlantsFilter } from "./PlantsFilter";
import { PlantsGallery } from "./PlantsGallery";
import { PlantData } from "./[plantId]/page";
import { PageHeader } from "../../components/shared/PageHeader";
import { client } from "@gredice/client";
import { Suspense } from "react";

export const revalidate = 3600; // 1 hour
export const dynamicParams = true;

export default async function PlantsPage() {
    const entities = await (await client().api.directories.entities[":entityType"].$get({
        param: {
            entityType: "plant"
        }
    })).json() as PlantData[];
    return (
        <Stack>
            <PageHeader
                padded
                header="Biljke"
                subHeader="Za tebe smo pripremili opširnu listu biljaka koje možeš pronaći u našem asortimanu.">
                <Suspense>
                    <PlantsFilter />
                </Suspense>
            </PageHeader>
            <Suspense>
                <PlantsGallery plants={entities} />
            </Suspense>
        </Stack>
    );
}