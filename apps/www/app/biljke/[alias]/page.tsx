import { Card } from "@signalco/ui-primitives/Card";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Chip } from "@signalco/ui-primitives/Chip";
import { Row } from "@signalco/ui-primitives/Row";
import { notFound } from "next/navigation";
import { PageHeader } from "../../../components/shared/PageHeader";
import { PlantYearCalendar } from "./PlantYearCalendar";
import { NoDataPlaceholder } from "../../../components/shared/placeholders/NoDataPlaceholder";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";
import { KnownPages } from "../../../src/KnownPages";
import { Accordion } from "@signalco/ui/Accordion";
import { slug } from "@signalco/js";
import { FeedbackModal } from "../../../components/shared/feedback/FeedbackModal";
import { PlantAttributeCards } from "./PlantAttributeCards";
import { InformationSection } from "./InformationSection";
import { VerifiedInformationBadge } from "./VerifiedInformationBadge";
import { PlantImage } from "../../../components/plants/PlantImage";
import { MapPinHouse } from "lucide-react";
import { getPlantsData } from "../../../lib/plants/getPlantsData";

export const revalidate = 3600; // 1 hour
export async function generateMetadata({ params }: { params: Promise<{ alias: string }> }) {
    const { alias: aliasUnescaped } = await params;
    const alias = aliasUnescaped ? decodeURIComponent(aliasUnescaped) : null;
    const plant = (await getPlantsData()).find((plant) => plant.information.name.toLowerCase() === alias?.toLowerCase());
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
    return plants.map((entity) => ({
        alias: String(entity.information.name),
    }));
}

type InformationSection = {
    header: string,
    id: 'sowing' | 'soilPreparation' | 'planting' | 'growth' | 'maintenance' | 'watering' | 'flowering' | 'harvest' | 'storage',
    avaialble: boolean
};

export default async function PlantPage(props: { params: Promise<{ alias: string }> }) {
    const { alias: aliasUnescaped } = await props.params;
    const alias = aliasUnescaped ? decodeURIComponent(aliasUnescaped) : null;
    if (!alias) {
        notFound();
    }

    const plant = (await getPlantsData()).find((plant) => plant.information.name.toLowerCase() === alias.toLowerCase());
    if (!plant) {
        notFound();
    }

    const informationSections: InformationSection[] = [
        { header: "Sijanje", id: "sowing", avaialble: Boolean(plant.information.sowing) },
        { header: "Priprema tla", id: "soilPreparation", avaialble: Boolean(plant.information.soilPreparation) },
        { header: "Sadnja", id: "planting", avaialble: Boolean(plant.information.planting) },
        { header: "Rast", id: "growth", avaialble: Boolean(plant.information.growth) },
        { header: "Održavanje", id: "maintenance", avaialble: Boolean(plant.information.maintenance) },
        { header: "Zalijevanje", id: "watering", avaialble: Boolean(plant.information.watering) },
        { header: "Cvjetanje", id: "flowering", avaialble: Boolean(plant.information.flowering) },
        { header: "Berba", id: "harvest", avaialble: Boolean(plant.information.harvest) },
        { header: "Skladištenje", id: "storage", avaialble: Boolean(plant.information.storage) },
    ];

    return (
        <div className="py-8">
            <Stack spacing={4}>
                <Breadcrumbs items={[
                    { label: 'Biljke', href: KnownPages.Plants },
                    { label: plant.information.name }
                ]} />
                <PageHeader
                    visual={(
                        <PlantImage plant={plant} priority width={142} height={142} />
                    )}
                    header={plant.information.name}
                    alternativeName={plant.information.latinName ? `lat. ${plant.information.latinName}` : null}
                    subHeader={plant.information.description}
                    headerChildren={(
                        <Stack spacing={2} alignItems="start">
                            {plant.information.origin && (
                                <Stack spacing={1}>
                                    <Typography level="body2">Porijeklo</Typography>
                                    <Row spacing={1}>
                                        <MapPinHouse className="size-5 shrink-0" />
                                        <Typography>{plant.information.origin}</Typography>
                                    </Row>
                                </Stack>
                            )}
                            {plant.information.verified && <VerifiedInformationBadge />}
                            {informationSections.some((section) => section.avaialble) && (
                                <Stack spacing={1}>
                                    <Typography level="body2">Sadržaj</Typography>
                                    <Row spacing={1} className="flex-wrap">
                                        {informationSections.filter((section) => section.avaialble).map((section) => (
                                            <Chip key={section.id} color="neutral" href={`#${slug(section.header)}`}>
                                                {section.header}
                                            </Chip>
                                        ))}
                                    </Row>
                                </Stack>
                            )}
                        </Stack>
                    )}>
                    <Stack>
                        <Stack spacing={1} className="group">
                            <Typography level="h2" className="text-2xl">Kalendar</Typography>
                            {(!plant.calendar || Object.keys(plant.calendar).length <= 0) ? (
                                <NoDataPlaceholder>
                                    Nema podataka o kalendaru
                                </NoDataPlaceholder>
                            ) : (
                                <Card className="p-0">
                                    <PlantYearCalendar activities={plant.calendar} />
                                </Card>
                            )}
                            <FeedbackModal
                                topic="www/plants/calendar"
                                data={{
                                    plantId: plant.id,
                                    plantAlias: alias
                                }}
                                className="self-end group-hover:opacity-100 opacity-0 transition-opacity" />
                        </Stack>
                        <Stack spacing={1} className="group">
                            <Typography level="h2" className="text-2xl">Svojstva</Typography>
                            <PlantAttributeCards attributes={plant.attributes} />
                            <FeedbackModal
                                topic="www/plants/attributes"
                                data={{
                                    plantId: plant.id,
                                    plantAlias: alias
                                }}
                                className="self-end group-hover:opacity-100 opacity-0 transition-opacity" />
                        </Stack>
                    </Stack>
                </PageHeader>
                {informationSections.filter((section) => section.avaialble).map((section) => (
                    <InformationSection
                        key={section.id}
                        plantId={plant.id}
                        id={section.id}
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
