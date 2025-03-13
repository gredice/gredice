import { Stack } from "@signalco/ui-primitives/Stack";
import { PageHeader } from "../../components/shared/PageHeader";
import { BlockData } from "./@types/BlockData";
import { client } from "@gredice/client";
import { Suspense } from "react";
import { PageFilterInput } from "../../components/shared/PageFilterInput";
import { BlockGallery } from "./BlockGallery";

export const revalidate = 3600; // 1 hour
export const dynamicParams = true;

export default async function BlocksPage() {
    const entities = await (await client().api.directories.entities[":entityType"].$get({
        param: {
            entityType: "block"
        }
    })).json() as BlockData[];
    return (
        <Stack>
            <PageHeader
                padded
                header="Blokovi"
                subHeader="Pregledaj sve blokove koje možeš koristiti u svom vrtu.">
                <Suspense>
                    <PageFilterInput
                        searchParamName="pretraga"
                        fieldName="block-search"
                        className="lg:flex items-start justify-end" />
                </Suspense>
            </PageHeader>
            <Suspense>
                <BlockGallery blocks={entities} />
            </Suspense>
        </Stack>
    );
}