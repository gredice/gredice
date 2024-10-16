import { Card, CardContent, CardHeader, CardOverflow, CardTitle } from "@signalco/ui-primitives/Card";
import { Modal } from "@signalco/ui-primitives/Modal";
import { Typography } from "@signalco/ui-primitives/Typography";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Container } from "@signalco/ui-primitives/Container";
import { Chip } from "@signalco/ui-primitives/Chip";
import { Row } from "@signalco/ui-primitives/Row";
import { CSSProperties, Fragment, PropsWithChildren, ReactNode } from "react";
import { Sun, Droplet, Sprout, Leaf, Ruler, ArrowDownToLine, BadgeCheck, Info } from "lucide-react"
import { notFound } from "next/navigation";
import { getEntityFormatted } from "@gredice/storage";
import Image from "next/image";
import Markdown from 'react-markdown'

function DetailCard({ icon, header, value }: { icon: React.ReactNode; header: string; value: string | null | undefined }) {
    return (
        <Card className="flex items-center">
            <Row spacing={2}>
                <div className="flex-shrink-0 ml-2 text-primary">{icon}</div>
                <div>
                    <Typography level="body2" component="h4">{header}</Typography>
                    <Typography semiBold>{value ?? '-'}</Typography>
                </div>
            </Row>
        </Card>
    )
}

function PlantAttributes({ attributes }: { attributes: PlantAttributes | undefined }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <DetailCard
                icon={<Sun className="w-6 h-6" />}
                header="Svijetlost"
                value={attributes?.light == null || Number.isNaN(attributes?.light) ? '-' : (attributes?.light > 0.3 ? 'Polu-sjena' : (attributes?.light > 0.7 ? 'Sunce' : 'Hlad'))} />
            <DetailCard icon={<Droplet className="w-6 h-6" />} header="Voda" value={attributes?.water} />
            <DetailCard icon={<Sprout className="w-6 h-6" />} header="Zemlja" value={attributes?.soil} />
            <DetailCard icon={<Leaf className="w-6 h-6" />} header="Nutrijenti" value={attributes?.nutrients} />
            <DetailCard icon={<Ruler className="w-6 h-6" />} header="Razmak sijanja/sadnje" value={`${attributes?.seedingDistance || '-'} cm`} />
            <DetailCard icon={<ArrowDownToLine className="w-6 h-6" />} header="Dubina sijanja" value={`${attributes?.seedingDepth || '-'} cm`} />
        </div>
    )
}

function NoDataPlaceholder({ children }: PropsWithChildren) {
    return (
        <Typography level="body2" center>
            {children || 'Nema podataka'}
        </Typography>
    )
}

export const dynamic = 'force-dynamic';

function InformationSection({ icon, header, content }: { icon: ReactNode, header: string, content: string }) {
    return (
        <Stack spacing={1}>
            <Row spacing={1}>
                {Boolean(icon) && icon}
                <Typography level="h5">{header}</Typography>
            </Row>
            <Markdown className="prose max-w-none">{content}</Markdown>
        </Stack>
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
    action: string
    icon: unknown
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
        tip?: { header: string, content: string }[] | null
    },
    image?: { cover?: { url?: string } },
    attributes?: PlantAttributes,
    calendar?: {
        [key: string]: { start: number, end: number }[]
    },
    instructions?: PlantInstruction[] | null,
    // companions?: number[],
    // antagonists?: number[],
    // diseases?: number[],
    // pests?: number[],
};

export default async function PlantPage(props: { params: Promise<{ plantId: string }> }) {
    const params = await props.params;
    const plantId = params.plantId;
    const plant = await getEntityFormatted(parseInt(plantId)) as unknown as PlantData;
    if (!plant)
        return notFound();

    return (
        <div className="py-10">
            <Container maxWidth="md">
                <Stack spacing={4}>
                    <div className="flex flex-col md:flex-row gap-4">
                        <Card className="min-w-48 min-h-48 size-48">
                            <CardOverflow className="p-6">
                                <Image
                                    src={plant.image?.cover?.url ?? '/assets/plants/placeholder.png'}
                                    alt={plant.information.name}
                                    width={142}
                                    height={142} />
                            </CardOverflow>
                        </Card>
                        <Stack spacing={2}>
                            <Typography level="h1">{plant.information.name}</Typography>
                            {plant.information.verified && (
                                <Row>
                                    <Chip color="success" size="sm">
                                        <BadgeCheck className="size-4" />
                                        <span>Verificirano</span>
                                    </Chip>
                                </Row>
                            )}
                            {plant.information.latinName && <Typography level="body2">lat. {plant.information.latinName}</Typography>}
                            {plant.information.description && <Typography level="body1" className="text-pretty">{plant.information.description}</Typography>}
                            {plant.information.origin && (
                                <Stack>
                                    <Typography level="body2">Porijeklo</Typography>
                                    <Typography>{plant.information.origin}</Typography>
                                </Stack>
                            )}
                        </Stack>
                    </div>
                    <Stack spacing={1}>
                        <Typography level="h5">Kalendar</Typography>
                        {(!plant.calendar || Object.keys(plant.calendar).length <= 0) ? (
                            <NoDataPlaceholder>
                                Nema podataka o kalendaru
                            </NoDataPlaceholder>
                        ) : (
                            <YearCalendar activities={plant.calendar} />
                        )}
                    </Stack>
                    <Stack spacing={1}>
                        <Typography level="h5">Svojstva</Typography>
                        <PlantAttributes attributes={plant.attributes} />
                    </Stack>
                    {plant.information.sowing && (
                        <InformationSection icon="🌱" header="Sijanje" content={plant.information.sowing} />
                    )}
                    {plant.information.soilPreparation && (
                        <InformationSection icon="🟤" header="Priprema tla" content={plant.information.soilPreparation} />
                    )}
                    {plant.information.planting && (
                        <InformationSection icon="🌿" header="Sadnja" content={plant.information.planting} />
                    )}
                    {plant.information.growth && (
                        <InformationSection icon="🌿" header="Rast" content={plant.information.growth} />
                    )}
                    {plant.information.maintenance && (
                        <InformationSection icon="✂️" header="Održavanje" content={plant.information.maintenance} />
                    )}
                    {plant.information.watering && (
                        <InformationSection icon="💧" header="Zalijevanje" content={plant.information.watering} />
                    )}
                    {plant.information.flowering && (
                        <InformationSection icon="🌸" header="Cvjetanje" content={plant.information.flowering} />
                    )}
                    {plant.information.harvest && (
                        <InformationSection icon="🟢" header="Berba" content={plant.information.harvest} />
                    )}
                    {plant.information.storage && (
                        <InformationSection icon="📦" header="Skladištenje" content={plant.information.storage} />
                    )}
                    {plant.instructions && (
                        <Stack spacing={1}>
                            <Typography level="h5">Postupak</Typography>
                            <PlantingInstructions instructions={plant.instructions} />
                        </Stack>
                    )}
                    {((plant.information.tip?.length ?? 0) > 0) && (
                        <Stack spacing={1}>
                            <Typography level="h5">
                                <Row spacing={1}>
                                    <Info />
                                    <span>Savjeti</span>
                                </Row>
                            </Typography>
                            <Stack spacing={1}>
                                {plant.information.tip?.map((tip) => (
                                    <Card key={tip.header}>
                                        <CardHeader>
                                            <CardTitle>{tip.header}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            {tip.content}
                                        </CardContent>
                                    </Card>
                                ))}
                            </Stack>
                        </Stack>
                    )}
                </Stack>
            </Container>
        </div>
    );
}

const calendarMonths = ['S', 'V', 'O', 'T', 'S', 'L', 'S', 'K', 'R', 'L', 'S', 'P']

const calendarActivityTypes = {
    sowing: {
        name: 'Sijanje',
        color: 'bg-yellow-400'
    },
    propagating: {
        name: 'Uzgoj',
        color: 'bg-blue-400'
    },
    planting: {
        name: 'Sadnja',
        color: 'bg-amber-600'
    },
    harvest: {
        name: 'Branje',
        color: 'bg-green-400'
    }
} as const;

function YearCalendar({ activities, now }: { activities: { [key: string]: { start: number, end: number }[] }, now?: Date }) {
    const currentDate = now ?? new Date();
    const currentMonth = currentDate.getMonth() // 0-indexed
    const currentMonthProgress = currentDate.getDate() / new Date(currentDate.getFullYear(), currentMonth, 0).getDate();

    return (
        <Card className="p-0 w-fit">
            <div className="grid grid-cols-[min-content_repeat(12,36px)] text-sm rounded-lg overflow-hidden">
                <div className="font-semibold p-2"></div>
                {calendarMonths.map((month, monthIndex) => (
                    <Typography level="body2" center key={monthIndex} className="p-2 border-l">
                        {month}
                    </Typography>
                ))}
                {Object.keys(calendarActivityTypes).map((activityTypeName) => {
                    const activityType = calendarActivityTypes[activityTypeName as keyof typeof calendarActivityTypes];
                    if (!Object.keys(activities).some(a => a === activityTypeName))
                        return null;

                    return (
                        <Fragment key={activityTypeName}>
                            <Row justifyContent="space-between" spacing={1} className="mx-2">
                                <Typography level="body2">
                                    {activityType.name}
                                </Typography>
                                <div className={`w-4 h-4 rounded-full inline-block ml-2 ${activityType.color}`}></div>
                            </Row>
                            <div className="col-span-12 h-6 flex items-center">
                                <div className="h-full w-full flex items-center relative">
                                    {calendarMonths.map((_, index) => {
                                        const month = index + 1;
                                        const currentActivities = activities[activityTypeName];
                                        const currentMonthActivities = currentActivities.filter(a => month >= Math.floor(a.start) && month <= Math.floor(a.end));
                                        const minStart = Math.min(...currentMonthActivities.map(a => a.start % 1));
                                        const maxEnd = Math.max(...currentMonthActivities.map(a => a.end % 1));
                                        const isActivityActive = currentMonthActivities.length > 0;
                                        const isActivityStart = currentActivities.some(a => month === Math.floor(a.start));
                                        const isActivityEnd = currentActivities.some(a => month === Math.floor(a.end));
                                        return (
                                            <div key={index} className="flex-grow h-full relative border-l">
                                                {isActivityActive && (
                                                    <div
                                                        className={`absolute inset-y-1 left-[--activity-left] -ml-[1px] right-[--activity-right] ${activityType.color} ${isActivityStart ? 'rounded-l-full' : ''} ${isActivityEnd ? 'rounded-r-full' : ''}`}
                                                        style={{
                                                            '--activity-left': isActivityStart ? `${(minStart) * 100}%` : '0px',
                                                            '--activity-right': isActivityEnd ? `${Math.min(75, (1 - maxEnd) * 100)}%` : '0px'
                                                        } as CSSProperties}
                                                    ></div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    <div
                                        className="absolute top-0 bottom-0 w-0.5 bg-red-600"
                                        style={{ left: `${((currentMonth + currentMonthProgress) / 12) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </Fragment>
                    );
                })}
            </div>
        </Card>
    )
}

function PlantingInstructions({ instructions }: { instructions?: PlantInstruction[] }) {
    return (
        <div className="p-4">
            <div className="space-y-4">
                {instructions?.map((instruction) => (
                    <div key={instruction.id} className="flex items-center group">
                        <div className="w-16 text-center font-semibold text-muted-foreground relative">
                            <span>Dan {instruction.relativeDays}</span>
                            <div className="group-first:hidden absolute top-0 left-1/2 w-0.5 h-[54px] bg-muted-foreground/20 transform -translate-y-full" />
                        </div>
                        {/* TODO: Extract insutrction card */}
                        <Card className="flex-grow ml-4">
                            <CardContent className="py-0 flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    <div className="text-primary">
                                        {/* TODO: Display instruction icon here */}
                                        {/* {instruction.icon} */}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold">{instruction.action}</h3>
                                        {instruction.frequency && (
                                            <p className="text-sm text-muted-foreground">{instruction.frequency}</p>
                                        )}
                                    </div>
                                </div>
                                <Modal trigger={(
                                    <IconButton
                                        size="lg"
                                        variant="plain"
                                        aria-label={`Više informacija o ${instruction.action}`}
                                    >
                                        {/* <!-- TODO: Replace with icon from @signalco/ui-icons --> */}
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            strokeWidth={1.5}
                                            stroke="currentColor"
                                            className="w-6 h-6"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                                            />
                                        </svg>
                                    </IconButton>
                                )}>
                                    <Typography level="h4">{instruction.action}</Typography>
                                    <p>{instruction.info}</p>
                                </Modal>
                            </CardContent>
                        </Card>
                    </div>
                ))}
            </div>
        </div>
    )
}