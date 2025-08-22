import { Stack } from "@signalco/ui-primitives/Stack";
import { PlantsGallery } from "./PlantsGallery";
import { PageHeader } from "../../components/shared/PageHeader";
import { Suspense } from "react";
import { FilterInput } from "@gredice/ui/FilterInput";
import { PlantsCalendar } from "./PlantsCalendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@signalco/ui-primitives/Tabs";
import { Calendar } from "@signalco/ui-icons";
import { Row } from "@signalco/ui-primitives/Row";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import Link from "next/link";
import { Typography } from "@signalco/ui-primitives/Typography";
import { FeedbackModal } from "../../components/shared/feedback/FeedbackModal";
import { getPlantsData } from "../../lib/plants/getPlantsData";
import { LayoutGrid } from "@signalco/ui-icons";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Biljke",
    description: "Za tebe smo pripremili opširnu listu biljaka koje možeš pronaći u našem asortimanu.",
};

export default async function PlantsPage({ searchParams }: PageProps<'/biljke'>) {
    const params = await searchParams;
    const view = params.pregled;
    const search = params.pretraga;
    const entities = await getPlantsData();
    return (
        <Stack>
            <PageHeader
                padded
                header="Biljke"
                subHeader="Za tebe smo pripremili opširnu listu biljaka koje možeš pronaći u našem asortimanu.">
                <Suspense>
                    <FilterInput
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
                    <TabsContent value="popis" className="mt-2">
                        <PlantsGallery plants={entities} />
                    </TabsContent>
                    <TabsContent value="kalendar" className="mt-2">
                        <Card>
                            <CardOverflow>
                                <PlantsCalendar plants={entities} />
                            </CardOverflow>
                        </Card>
                    </TabsContent>
                </Tabs>
            </Suspense>
            <Row spacing={2} className="mt-12">
                <Typography level="body1">Sviđa ti se odabir ili nema biljke koja te zanima?</Typography>
                <FeedbackModal topic="www/plants" />
            </Row>
        </Stack>
    );
}