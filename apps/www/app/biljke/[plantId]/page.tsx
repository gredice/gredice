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
import Markdown from 'react-markdown'
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
        plantId: String(entity.id),
    }));
}

function InformationSection({ header, content, instructions }: { header: string, content: string | null | undefined, instructions?: PlantInstruction[] }) {
    if (!content) {
        return null;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
            <Typography level="h4" className="md:col-span-2">{header}</Typography>
            <div className="prose prose-p:my-2 max-w-none">
                <Markdown>{content}</Markdown>
            </div>
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

export default async function PlantPage(props: { params: Promise<{ plantId: string }> }) {
    const params = await props.params;
    const plantId = params.plantId;
    const plantResponse = await client().api.directories.entities[":entityType"][":entityId"].$get({
        param: {
            entityType: "plant",
            entityId: plantId
        }
    });
    if (!plantResponse.ok) {
        return notFound();
    }
    const plant = await plantResponse.json() as PlantData;
    if (!plant) {
        return notFound();
    }

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
                        <Stack spacing={1} alignItems="start">
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
                        </Stack>
                    )}>
                    <Stack spacing={4}>
                        <Stack spacing={1}>
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
                        </Stack>
                        <Stack spacing={1}>
                            <Typography level="h5">Svojstva</Typography>
                            <PlantAttributes attributes={plant.attributes} />
                        </Stack>
                    </Stack>
                </PageHeader>
                <InformationSection header="Sijanje" content={plant.information.sowing} instructions={plant.information.instructions?.filter(i => i.stage === 'sowing')} />
                <InformationSection header="Priprema tla" content={plant.information.soilPreparation} instructions={plant.information.instructions?.filter(i => i.stage === 'soilPreparation')} />
                <InformationSection header="Sadnja" content={plant.information.planting} instructions={plant.information.instructions?.filter(i => i.stage === 'planting')} />
                <InformationSection header="Rast" content={plant.information.growth} instructions={plant.information.instructions?.filter(i => i.stage === 'growth')} />
                <InformationSection header="Održavanje" content={plant.information.maintenance} instructions={plant.information.instructions?.filter(i => i.stage === 'maintenance')} />
                <InformationSection header="Zalijevanje" content={plant.information.watering} instructions={plant.information.instructions?.filter(i => i.stage === 'watering')} />
                <InformationSection header="Cvjetanje" content={plant.information.flowering} instructions={plant.information.instructions?.filter(i => i.stage === 'flowering')} />
                <InformationSection header="Berba" content={plant.information.harvest} instructions={plant.information.instructions?.filter(i => i.stage === 'harvest')} />
                <InformationSection header="Skladištenje" content={plant.information.storage} instructions={plant.information.instructions?.filter(i => i.stage === 'storage')} />
                {((plant.information.tip?.length ?? 0) > 0) && (
                    <Stack spacing={2}>
                        <Typography level="h4">
                            Savjeti
                        </Typography>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {plant.information.tip?.map((tip) => (
                                <Accordion defaultOpen key={tip.header} className="h-fit">
                                    <Typography level="h6" secondary>{tip.header}</Typography>
                                    <Typography>{tip.content}</Typography>
                                </Accordion>
                            ))}
                        </div>
                    </Stack>
                )}
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