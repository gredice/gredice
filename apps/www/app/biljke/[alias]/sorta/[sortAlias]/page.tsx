import { notFound } from "next/navigation";
import { Stack } from "@signalco/ui-primitives/Stack";
import { getPlantsData } from "../../../../../lib/plants/getPlantsData";
import { getPlantSortsData } from "../../../../../lib/plants/getPlantSortsData";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";
import { KnownPages } from "../../../../../src/KnownPages";
import { PlantPageHeader } from "../../PlantPageHeader";
import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";
import { FeedbackModal } from "../../../../../components/shared/feedback/FeedbackModal";

export default async function PlantSortPage({ params }: { params: Promise<{ alias: string, sortAlias: string }> }) {
    const { alias: aliasUnescaped, sortAlias: sortAliasUnescaped } = await params;
    const alias = aliasUnescaped ? decodeURIComponent(aliasUnescaped) : null;
    const sort = sortAliasUnescaped ? decodeURIComponent(sortAliasUnescaped) : null;
    if (!alias || !sort) {
        console.log("Invalid parameters for plant sort page:", params);
        notFound();
    }

    const [plants, sorts] = await Promise.all([getPlantsData(), getPlantSortsData()]);
    const basePlantData = plants?.find(p => p.information.name.toLowerCase() === alias.toLowerCase());
    const sortData = sorts?.find(s => s.information.name.toLowerCase() === sort.toLowerCase() && s.information.plant.information?.name?.toLowerCase() === alias.toLowerCase());
    if (!basePlantData || !sortData) {
        console.log("Base plant or sort not found:", { basePlantData, sortData });
        notFound();
    }

    return (
        <div className="py-8">
            <Stack spacing={4}>
                <Breadcrumbs items={[
                    { label: 'Biljke', href: KnownPages.Plants },
                    { label: basePlantData.information.name, href: KnownPages.Plant(alias) },
                    { label: "Sorte", href: KnownPages.Plant(alias) + "#sorte" },
                    { label: sortData.information.name }
                ]} />
                <PlantPageHeader
                    plant={basePlantData}
                    sort={sortData} />
                <Row spacing={2}>
                    <Typography level="body1">Jesu li ti informacije o ovoj biljci korisne?</Typography>
                    <FeedbackModal
                        topic="www/plants/sorts/details"
                        data={{
                            plantId: basePlantData.id,
                            plantAlias: alias,
                            sortId: sortData.id,
                            sortAlias: sort
                        }} />
                </Row>
            </Stack>
        </div>
    );
}
