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
import { getPlantInforationSections } from "../../getPlantInforationSections";
import { InformationSection } from "../../InformationSection";
import { PlantTips } from "../../PlantTips";
import { Metadata } from "next";

export const revalidate = 3600; // 1 hour
export async function generateMetadata({ params }: { params: Promise<{ alias: string, sortAlias: string }> }): Promise<Metadata> {
    const { alias: aliasUnescaped, sortAlias: sortAliasUnescaped } = await params;
    const alias = aliasUnescaped ? decodeURIComponent(aliasUnescaped) : null;
    const sortAlias = sortAliasUnescaped ? decodeURIComponent(sortAliasUnescaped) : null;
    const sort = (await getPlantSortsData())?.find((sort) =>
        sort.information.plant.information?.name.toLowerCase() === alias?.toLowerCase() &&
        sort.information.name.toLowerCase() === sortAlias?.toLowerCase());
    if (!sort) {
        return {
            title: "Sorta nije pronađena",
            description: "Sorta nije pronađena",
        };
    }
    return {
        title: sort.information.name,
        description: sort.information.description
    };
}

export async function generateStaticParams() {
    const sorts = await getPlantSortsData();
    return sorts?.map((entity) => ({
        alias: String(entity.information.plant.information?.name),
        sortAlias: String(entity.information.name),
    }));
}

export default async function PlantSortPage({ params }: { params: Promise<{ alias: string, sortAlias: string }> }) {
    const { alias: aliasUnescaped, sortAlias: sortAliasUnescaped } = await params;
    const alias = aliasUnescaped ? decodeURIComponent(aliasUnescaped) : null;
    const sort = sortAliasUnescaped ? decodeURIComponent(sortAliasUnescaped) : null;
    if (!alias || !sort) {
        console.warn("Invalid parameters for plant sort page:", params);
        notFound();
    }

    const [plants, sorts] = await Promise.all([getPlantsData(), getPlantSortsData()]);
    const basePlantData = plants?.find(p => p.information.name.toLowerCase() === alias.toLowerCase());
    const sortData = sorts?.find(s => s.information.name.toLowerCase() === sort.toLowerCase() && s.information.plant.information?.name?.toLowerCase() === alias.toLowerCase());
    if (!basePlantData || !sortData) {
        console.error("Base plant or sort not found:", { basePlantData, sortData });
        notFound();
    }

    const informationSections = getPlantInforationSections(basePlantData);

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
                {informationSections.filter((section) => section.avaialble).map((section) => (
                    <InformationSection
                        key={section.id}
                        id={section.id}
                        plantId={basePlantData.id}
                        header={section.header}
                        content={basePlantData.information[section.id]}
                        sortContent={sortData.information[section.id]}
                        operations={basePlantData.information.operations} />
                ))}
                {((basePlantData.information.tip?.length ?? 0) > 0) && (
                    <PlantTips plant={basePlantData} />
                )}
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
