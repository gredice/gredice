import { Card, CardContent } from "@signalco/ui-primitives/Card";
import { Modal } from "@signalco/ui-primitives/Modal";
import { Typography } from "@signalco/ui-primitives/Typography";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Chip } from "@signalco/ui-primitives/Chip";
import { Row } from "@signalco/ui-primitives/Row";
import { Sun, Droplet, Sprout, Leaf, Ruler, ArrowDownToLine, BadgeCheck, Info } from "lucide-react"
import { notFound } from "next/navigation";
import Image from "next/image";
import { PageHeader } from "../../../components/shared/PageHeader";
import { PlantYearCalendar } from "./PlantYearCalendar";
import { NoDataPlaceholder } from "../../../components/shared/placeholders/NoDataPlaceholder";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";
import { KnownPages } from "../../../src/KnownPages";
import { Popper } from "@signalco/ui-primitives/Popper";
import { cx } from "@signalco/ui-primitives/cx";
import { Accordion } from "@signalco/ui/Accordion";
import { AttributeCard } from "../../../components/attributes/DetailCard";
import { client } from "@gredice/client";
import { Markdown } from "../../../components/shared/Markdown";
import { slug } from "@signalco/js";
import { FeedbackModal } from "../../../components/shared/feedback/FeedbackModal";
import { FeedbackTrigger } from "../../../components/shared/feedback/FeedbackTriggerLike";

function PlantAttributes({ attributes }: { attributes: PlantAttributes | undefined }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <AttributeCard
                icon={<Sun className="w-6 h-6" />}
                header="Svijetlost"
                value={attributes?.light == null || Number.isNaN(attributes?.light) ? '-' : (attributes?.light > 0.3 ? 'Polu-sjena' : (attributes?.light > 0.7 ? 'Sunce' : 'Hlad'))} />
            <AttributeCard icon={<Droplet className="w-6 h-6" />} header="Voda" value={attributes?.water} />
            <AttributeCard icon={<Sprout className="w-6 h-6" />} header="Zemlja" value={attributes?.soil} />
            <AttributeCard icon={<Leaf className="w-6 h-6" />} header="Nutrijenti" value={attributes?.nutrients} />
            <AttributeCard icon={<Ruler className="w-6 h-6" />} header="Razmak sijanja/sadnje" value={`${attributes?.seedingDistance || '-'} cm`} />
            <AttributeCard icon={<ArrowDownToLine className="w-6 h-6" />} header="Dubina sijanja" value={`${attributes?.seedingDepth || '-'} cm`} />
        </div>
    )
}

export const revalidate = 3600; // 1 hour
export const dynamicParams = true;

export async function generateStaticParams() {
    const entities = await (await client().api.directories.entities[":entityType"].$get({
        param: {
            entityType: "plant"
        }
    })).json() as PlantData[];

    return entities.map((entity) => ({
        alias: String(entity.information.name),
    }));
}

function InformationSection({ plantId, id, header, content, instructions }: { plantId: number, id: string, header: string, content: string | null | undefined, instructions?: PlantInstruction[] }) {
    if (!content) {
        return null;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 group">
            <div className="flex justify-between">
                <Typography id={slug(header)} level="h4">{header}</Typography>
                <FeedbackModal
                    className="group-hover:opacity-100 opacity-0 transition-opacity"
                    topic="www/plants/information"
                    data={{
                        plantId: plantId,
                        sectionId: id
                    }}
                />
            </div>
            <div className="hidden md:block" />
            <Markdown>{content}</Markdown>
            <Stack className={cx("border rounded-lg p-2 h-fit", !instructions?.length && 'justify-center')}>
                {(instructions?.length ?? 0) <= 0 && (
                    <NoDataPlaceholder className="self-center py-4">
                        Nema dostupnih akcija
                    </NoDataPlaceholder>
                )}
                {(instructions?.length ?? 0) > 0 && (
                    <PlantingInstructions instructions={instructions} />
                )}
            </Stack>
        </div>
    )
}

export type PlantAttributes = {
    light?: number | null
    water?: string | null
    soil?: string | null
    nutrients?: string | null
    seedingDistance?: number | null
    seedingDepth?: number | null
};

export type PlantInstruction = {
    id: number
    actionId: string,
    stage: string,
    label: string,
    iconUrl: string,
    frequency?: string
    info: string
    relativeDays: number
};

export type PlantData = {
    id: number,
    // plantFamily?: PlantFamily,
    information: {
        name: string,
        verified: boolean,
        description?: string | null,
        origin?: string | null,
        latinName?: string | null,
        soilPreparation?: string | null,
        sowing?: string | null,
        planting?: string | null,
        flowering?: string | null,
        maintenance?: string | null,
        growth?: string | null,
        harvest?: string | null,
        storage?: string | null,
        watering?: string | null,
        instructions?: PlantInstruction[] | null,
        tip?: { header: string, content: string }[] | null
    },
    image?: { cover?: { url?: string } },
    attributes?: PlantAttributes,
    calendar?: {
        [key: string]: { start: number, end: number }[]
    },
    // companions?: number[],
    // antagonists?: number[],
    // diseases?: number[],
    // pests?: number[],
};

export default async function PlantPage(props: { params: Promise<{ alias: string }> }) {
    const { alias: aliasUnescaped } = await props.params;
    const alias = aliasUnescaped ? decodeURIComponent(aliasUnescaped) : null;
    if (!alias) {
        return notFound();
    }

    const plants = await (await client().api.directories.entities[":entityType"].$get({
        param: {
            entityType: "plant"
        }
    })).json() as PlantData[];
    const plant = plants.find((plant) => plant.information.name === alias);
    if (!plant) {
        return notFound();
    }

    const informationSections: {
        header: string,
        id: 'sowing' | 'soilPreparation' | 'planting' | 'growth' | 'maintenance' | 'watering' | 'flowering' | 'harvest' | 'storage',
        avaialble: boolean
    }[] = [
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
                        <Image
                            src={plant.image?.cover?.url ?? '/assets/plants/placeholder.png'}
                            alt={plant.information.name}
                            width={142}
                            height={142}
                            priority />
                    )}
                    header={plant.information.name}
                    alternativeName={plant.information.latinName ? `lat. ${plant.information.latinName}` : null}
                    subHeader={plant.information.description}
                    headerChildren={(
                        <Stack spacing={2} alignItems="start">
                            {plant.information.origin && (
                                <Stack>
                                    <Typography level="body2">Porijeklo</Typography>
                                    <Typography>{plant.information.origin}</Typography>
                                </Stack>
                            )}
                            {plant.information.verified && (
                                <Popper
                                    trigger={(
                                        <Chip color="success" className="cursor-default hover:bg-lime-400">
                                            <BadgeCheck className="size-4" />
                                            <span>Odobreno</span>
                                        </Chip>
                                    )}
                                    className="p-6 min-w-96"
                                >
                                    <Stack spacing={2}>
                                        <Row spacing={2}>
                                            <BadgeCheck className="size-10 text-secondary-foreground" />
                                            <Typography level="body2" semiBold>&quot;Odobreno&quot; označava da su informacije provjerene.</Typography>
                                        </Row>
                                        <Stack spacing={1}>
                                            <Typography>
                                                Da bismo osigurali točnost podataka, naši stručnjaci provjeravaju sve informacije jednu po jednu.
                                            </Typography>
                                            <Typography>
                                                Zelena kvačica označava da su informacije o biljci provjerene i ocijenjene kao ispravne.
                                            </Typography>
                                        </Stack>
                                    </Stack>
                                </Popper>
                            )}
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
                        </Stack>
                    )}>
                    <Stack>
                        <Stack spacing={1} className="group">
                            <Typography level="h5">Kalendar</Typography>
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
                            <Typography level="h5">Svojstva</Typography>
                            <PlantAttributes attributes={plant.attributes} />
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
                        instructions={plant.information.instructions?.filter(i => i.stage === section.id)} />
                ))}
                {((plant.information.tip?.length ?? 0) > 0) && (
                    <Stack spacing={2}>
                        <Typography level="h4">
                            Savjeti
                        </Typography>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {plant.information.tip?.map((tip) => (
                                <Accordion defaultOpen key={tip.header} className="h-fit">
                                    <Typography level="h6" secondary>{tip.header}</Typography>
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
                    <Typography level="body1">Jesu li ti informacije bile korisne?</Typography>
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

function PlantingInstructions({ instructions }: { instructions?: PlantInstruction[] }) {
    return (
        <div className="space-y-4">
            {instructions?.map((instruction) => (
                <div key={instruction.id} className="flex flex-col md:flex-row md:items-center group gap-x-4">
                    <div className="w-16 font-semibold text-muted-foreground relative">
                        <span>Dan {instruction.relativeDays}</span>
                        <div className="group-first:hidden absolute top-0 left-1/2 w-0.5 h-[54px] bg-muted-foreground/20 transform -translate-y-full" />
                    </div>
                    {/* TODO: Extract insutrction card */}
                    <Card className="flex-grow">
                        <CardContent className="py-0 pl-3 pr-0 flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <Image src={instruction.iconUrl} width={32} height={32} alt={instruction.label} />
                                <div>
                                    <h3 className="font-semibold">{instruction.label}</h3>
                                    {instruction.frequency && (
                                        <p className="text-sm text-muted-foreground">{instruction.frequency}</p>
                                    )}
                                </div>
                            </div>
                            <Modal
                                title={instruction.label}
                                trigger={(
                                    <IconButton
                                        size="lg"
                                        variant="plain"
                                        aria-label={`Više informacija o ${instruction.label}`}
                                    >
                                        <Info />
                                    </IconButton>
                                )}>
                                <Typography level="h4">{instruction.label}</Typography>
                                <p>{instruction.info}</p>
                            </Modal>
                        </CardContent>
                    </Card>
                </div>
            ))}
        </div>
    )
}