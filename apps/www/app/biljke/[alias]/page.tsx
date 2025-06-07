import { Typography } from "@signalco/ui-primitives/Typography";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Row } from "@signalco/ui-primitives/Row";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";
import { KnownPages } from "../../../src/KnownPages";
import { Accordion } from "@signalco/ui/Accordion";
import { FeedbackModal } from "../../../components/shared/feedback/FeedbackModal";
import { InformationSection } from "./InformationSection";
import { getPlantsData } from "../../../lib/plants/getPlantsData";
import { PlantSortsList } from "./PlantSortsList";
import { PlantPageHeader } from "./PlantPageHeader";
import { getPlantInforationSections } from "./getPlantInforationSections";

export async function generateMetadata({ params }: { params: Promise<{ alias: string }> }) {
    const { alias: aliasUnescaped } = await params;
    const alias = aliasUnescaped ? decodeURIComponent(aliasUnescaped) : null;
    const plant = (await getPlantsData())?.find((plant) => plant.information.name.toLowerCase() === alias?.toLowerCase());
    if (!plant) {
        return {
            title: "Biljka nije pronađena",
            description: "Biljka nije pronađena",
        };
    }
    return {
        title: plant.information.name,
        description: plant.information.description
    };
}

export async function generateStaticParams() {
    const plants = await getPlantsData();
    return plants?.map((entity) => ({
        alias: String(entity.information.name),
    }));
}

export default async function PlantPage(props: { params: Promise<{ alias: string }> }) {
    const { alias: aliasUnescaped } = await props.params;
    const alias = aliasUnescaped ? decodeURIComponent(aliasUnescaped) : null;
    if (!alias) {
        notFound();
    }

    const plant = (await getPlantsData())?.find((plant) => plant.information.name.toLowerCase() === alias.toLowerCase());
    if (!plant) {
        notFound();
    }

    const informationSections = getPlantInforationSections(plant);

    return (
        <div className="py-8">
            <Stack spacing={4}>
                <Breadcrumbs items={[
                    { label: 'Biljke', href: KnownPages.Plants },
                    { label: plant.information.name }
                ]} />
                <PlantPageHeader plant={plant} />
                {informationSections.filter((section) => section.avaialble).map((section) => (
                    <InformationSection
                        key={section.id}
                        id={section.id}
                        plantId={plant.id}
                        header={section.header}
                        content={plant.information[section.id]}
                        operations={plant.information.operations} />
                ))}
                {((plant.information.tip?.length ?? 0) > 0) && (
                    <Stack spacing={2}>
                        <Typography level="h2" className="text-2xl">
                            Savjeti
                        </Typography>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {plant.information.tip?.map((tip) => (
                                <Accordion defaultOpen key={tip.header} className="h-fit">
                                    <Typography level="h3" className="text-lg" semiBold secondary>{tip.header}</Typography>
                                    <Stack spacing={2}>
                                        <Typography>{tip.content}</Typography>
                                        <FeedbackModal
                                            className="self-end"
                                            topic="www/plants/advice"
                                            data={{
                                                plantId: plant.id,
                                                tipHeader: tip.header
                                            }}
                                        />
                                    </Stack>
                                </Accordion>
                            ))}
                        </div>
                    </Stack>
                )}
                <PlantSortsList basePlantName={plant.information.name} />
                <Row spacing={2}>
                    <Typography level="body1">Jesu li ti informacije o ovoj biljci korisne?</Typography>
                    <FeedbackModal
                        topic="www/plants/details"
                        data={{
                            plantId: plant.id,
                            plantAlias: alias
                        }} />
                </Row>
            </Stack>
        </div>
    );
}
