import { Stack } from "@signalco/ui-primitives/Stack";
import { PlantsGallery } from "./PlantsGallery";
import { PlantData } from "./[alias]/page";
import { PageHeader } from "../../components/shared/PageHeader";
import { client } from "@gredice/client";
import { Suspense } from "react";
import { PageFilterInput } from "../../components/shared/PageFilterInput";
import { PlantsCalendar } from "./PlantsCalendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@signalco/ui-primitives/Tabs";
import { Calendar, LayoutGrid } from "lucide-react";
import { Row } from "@signalco/ui-primitives/Row";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import Link from "next/link";

export const revalidate = 3600; // 1 hour

export default async function PlantsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const params = await searchParams;
    const view = params.pregled;
    const search = params.pretraga;
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
                    <PageFilterInput
                        searchParamName="pretraga"
                        fieldName="plant-search"
                        className="lg:flex items-start justify-end" />
                </Suspense>
            </PageHeader>
            <Suspense>
                <Tabs value={view} defaultValue="popis" className="w-full">
                    <TabsList className="grid grid-cols-2 w-fit border">
                        <Link href={`?pregled=popis${search ? `&pretraga=${search}` : ''}`} prefetch>
                            <TabsTrigger value="popis" className="w-full">
                                <Row spacing={1} className="cursor-default">
                                    <LayoutGrid className="size-5" />
                                    <span>Popis</span>
                                </Row>
                            </TabsTrigger>
                        </Link>
                        <Link href={`?pregled=kalendar${search ? `&pretraga=${search}` : ''}`} prefetch>
                            <TabsTrigger value="kalendar" className="w-full">
                                <Row spacing={1} className="cursor-default">
                                    <Calendar className="size-5" />
                                    <span>Kalendar</span>
                                </Row>
                            </TabsTrigger>
                        </Link>
                    </TabsList>
                    <TabsContent value="popis" className="mt-4">
                        <PlantsGallery plants={entities} />
                    </TabsContent>
                    <TabsContent value="kalendar" className="mt-4">
                        <Card>
                            <CardOverflow>
                                <PlantsCalendar plants={entities} />
                            </CardOverflow>
                        </Card>
                    </TabsContent>
                </Tabs>
            </Suspense>
        </Stack>
    );
}