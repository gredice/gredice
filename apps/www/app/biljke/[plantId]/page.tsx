'use client';

import { Card, CardContent, CardHeader, CardOverflow, CardTitle } from "@signalco/ui-primitives/Card";
import { Modal } from "@signalco/ui-primitives/Modal";
import { Typography } from "@signalco/ui-primitives/Typography";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Container } from "@signalco/ui-primitives/Container";
import { Row } from "@signalco/ui-primitives/Row";
import { Fragment } from "react";
import { Sun, Droplet, Sprout, Leaf, Ruler, ArrowDownToLine } from "lucide-react"

interface PlantAttributes {
    light: number
    water: string
    soil: string
    nutrients: string
    seedingDistance: number
    seedingDepth: number
};

type PlantActivity = {
    name: keyof typeof activityTypes
    start: number
    end: number
};

type PlantInstruction = {
    id: number
    action: string
    icon: React.ReactNode
    frequency?: string
    info: string
    relativeDays: number
};

type PlantData = {
    id: number,
    verified: boolean,
    name: string,
    latinName?: string,
    // plantFamily?: PlantFamily,
    information: {
        description?: string,
        origin?: string,
        tips?: { header: string, content: string }[]
    },
    images: { url: string }[],
    attributes?: PlantAttributes,
    activities?: PlantActivity[],
    instructions?: PlantInstruction[],
    companions?: number[],
    antagonists?: number[],
    diseases?: number[],
    pests?: number[],
};

function DetailCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
    return (
        <Card className="flex items-center">
            <Row spacing={2}>
                <div className="flex-shrink-0 ml-2 text-primary">{icon}</div>
                <div>
                    <Typography level="body2" component="h4">{title}</Typography>
                    <Typography semiBold>{value}</Typography>
                </div>
            </Row>
        </Card>
    )
}

export function PlantAttributes({ attributes }: { attributes: PlantAttributes }) {
    const { light, water, soil, nutrients, seedingDistance, seedingDepth } = attributes ?? plant.attributes;
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <DetailCard icon={<Sun className="w-6 h-6" />} title="Svijetlost" value={light} />
            <DetailCard icon={<Droplet className="w-6 h-6" />} title="Voda" value={water} />
            <DetailCard icon={<Sprout className="w-6 h-6" />} title="Zemlja" value={soil} />
            <DetailCard icon={<Leaf className="w-6 h-6" />} title="Nutrijenti" value={nutrients} />
            <DetailCard icon={<Ruler className="w-6 h-6" />} title="Razmak sijanja" value={`${seedingDistance} cm`} />
            <DetailCard icon={<ArrowDownToLine className="w-6 h-6" />} title="Dubina sijanja" value={`${seedingDepth} cm`} />
        </div>
    )
}

const plant: PlantData = {
    id: 1,
    verified: true,
    name: "Mrkva",
    latinName: "Daucus carota",
    information: {
        description: "Mrkva je dvogodišnja biljka iz porodice štitarki (Apiaceae).",
        origin: "Srednja Europa",
        tips: [
            { header: "Priprema tla", content: "Korjenasto povrće voli rahlu zemlju kako bi korijeni bili lijepi i ravni, pa zato i za mrkvu treba pripremiti rahlu gredicu. Ako se mrkva sije u zimskom roku, tada se sije u niske i poluvisoke tople tunele. Drenaža je iznimno važna kako bi se spriječilo truljenje korijena. Dok je mrkvama potrebna vlaga u tlu, mokri uvjeti uzrokovat će truljenje korijena. Dobra mješavina tla i puno komposta trebali bi ublažiti probleme s drenažom u podignutim gredicama." },
            { header: "Cvijetanje", content: "Mrkva je dvogodišnja biljka. Ako ne uspijete ubrati i ostavite mrkvu u zemlji, vrhovi će procvjetati i dati sjeme sljedeće godine." },
            { header: "Hladnoća", content: "Mrkvi ne smeta mraz, naprotiv, hladnoća zasladi mrkve." }
        ]
    },
    images: [
        { url: "/assets/vegetables/carrot-realistic-340.png" }
    ],
    attributes: {
        light: 0.8,
        water: "18ml tjedno po mrkvi",
        soil: "Rahlo",
        nutrients: "Srednje",
        seedingDistance: 3,
        seedingDepth: 0.6
    },
    activities: [
        { name: 'sowing', start: 3, end: 6 },
        { name: 'harvest', start: 8, end: 10 },
    ],
    instructions: [
        { id: 1, action: "Sijanje", icon: <div className="h-6 w-6" />, info: "Plant seeds 1/4 inch deep in well-prepared soil.", relativeDays: 1 },
        { id: 2, action: "Pljeviti", icon: <div className="h-6 w-6" />, frequency: "Every week", info: "Remove weeds to prevent competition for nutrients.", relativeDays: 8 },
        { id: 3, action: "Zastita od nametnika", icon: <div className="h-6 w-6" />, info: "Apply organic pest control methods as needed.", relativeDays: 15 },
        { id: 4, action: "Malciranje", icon: <div className="h-6 w-6" />, frequency: "Thinly", info: "Apply a thin layer of organic mulch to retain moisture.", relativeDays: 22 },
        { id: 5, action: "Zalijevanje", icon: <div className="h-6 w-6" />, frequency: "Every 1-2 weeks", info: "Water deeply, allowing soil to dry between waterings.", relativeDays: 29 },
        { id: 6, action: "Malciranje", icon: <div className="h-6 w-6" />, info: "Add another layer of mulch as plants grow.", relativeDays: 36 },
        { id: 7, action: "Prorijedivanje", icon: <div className="h-6 w-6" />, info: "Remove weaker seedlings to give strong plants room to grow.", relativeDays: 43 },
        { id: 8, action: "Berba", icon: <div className="h-6 w-6" />, frequency: "Every week through 1 month", info: "Harvest mature produce regularly to encourage continued production.", relativeDays: 71 },
    ],
    antagonists: [2, 3],
    companions: [4, 5],
    diseases: [6, 7],
}

export default function PlantPage() {
    return (
        <div className="bg-[#FDF6F0] py-10">
            <Container maxWidth="sm">
                <Stack spacing={4}>
                    <Row spacing={2} alignItems="start">
                        <Card className="size-36">
                            <CardOverflow>
                                <div className="flex-grow">
                                    <img src={plant.images[0].url} alt={plant.name} className="w-full rounded-lg" />
                                </div>
                            </CardOverflow>
                        </Card>
                        <Stack spacing={2}>
                            <Typography level="h1">{plant.name}</Typography>
                            <Typography level="body1">{plant.information.description}</Typography>
                            {plant.information.origin && (
                                <Stack>
                                    <Typography level="body2">Porijeklo</Typography>
                                    <Typography>{plant.information.origin}</Typography>
                                </Stack>
                            )}
                        </Stack>
                    </Row>
                    <Stack spacing={1}>
                        <Typography level="h5">Kalendar</Typography>
                        <YearCalendar activities={plant.activities} />
                    </Stack>
                    <Stack spacing={1}>
                        <Typography level="h5">Svojstva</Typography>
                        <PlantAttributes attributes={plant.attributes} />
                    </Stack>
                    <Stack spacing={1}>
                        <Typography level="h5">Postupak</Typography>
                        <PlantingInstructions instructions={plant.instructions} />
                    </Stack>
                    <Stack spacing={1}>
                        <Typography level="h5">Savjeti</Typography>
                        <Stack spacing={1}>
                            {plant.information.tips.map((tip) => (
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
                </Stack>
            </Container>
        </div>
    );
}

const months = ['S', 'V', 'O', 'T', 'S', 'L', 'S', 'K', 'R', 'L', 'S', 'P']

const activityTypes = {
    sowing: {
        name: 'Sijanje',
        color: 'bg-yellow-400'
    },
    propagating: {
        name: 'Propagating',
        color: 'bg-blue-400'
    },
    planting: {
        name: 'Planting',
        color: 'bg-amber-600'
    },
    harvest: {
        name: 'Branje',
        color: 'bg-green-400'
    }
} as const;

export function YearCalendar({ activities, now }: { activities: PlantActivity[], now?: Date }) {
    const currentDate = now ?? new Date();
    const currentMonth = currentDate.getMonth() // 0-indexed
    const currentMonthProgress = currentDate.getDate() / new Date(currentDate.getFullYear(), currentMonth, 0).getDate();

    return (
        <Card className="p-0">
            <div className="grid grid-cols-[auto_repeat(12,1fr)] text-sm rounded-lg overflow-hidden">
                <div className="font-semibold p-2"></div>
                {months.map((month) => (
                    <Typography level="body2" center key={month} className="p-2 border-l">
                        {month}
                    </Typography>
                ))}
                {Object.keys(activityTypes).map((activityTypeName) => {
                    const activityType = activityTypes[activityTypeName];
                    if (!activities.some(a => a.name === activityTypeName))
                        return null;

                    return (
                        <Fragment key={activityType.name}>
                            <Row justifyContent="space-between" spacing={1} className="mx-2">
                                <Typography level="body2">
                                    {activityType.name}
                                </Typography>
                                <div className={`w-4 h-4 rounded-full inline-block ml-2 ${activityType.color}`}></div>
                            </Row>
                            <div className="col-span-12 h-6 flex items-center">
                                <div className="h-full w-full flex items-center relative">
                                    {months.map((_, index) => {
                                        const isActivityActive = activities.some(a => a.name === activityTypeName && index + 1 >= a.start && index + 1 <= a.end);
                                        const isActivityStart = activities.some(a => a.name === activityTypeName && index + 1 === a.start);
                                        const isActivityEnd = activities.some(a => a.name === activityTypeName && index + 1 === a.end);
                                        return (
                                            <div key={index} className="flex-grow h-full relative border-l">
                                                {isActivityActive && (
                                                    <div
                                                        className={`absolute inset-y-1 left-0 -ml-[1px] right-0 ${activityType.color} ${isActivityStart ? 'rounded-l-full' : ''} ${isActivityEnd ? 'rounded-r-full' : ''}`}
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

export function PlantingInstructions({ instructions }: { instructions: PlantInstruction[] }) {
    return (
        <div className="p-4">
            <div className="space-y-4">
                {instructions.map((instruction) => (
                    <div key={instruction.id} className="flex items-center group">
                        <div className="w-16 text-center font-semibold text-muted-foreground relative">
                            <span>Dan {instruction.relativeDays}</span>
                            <div className="group-first:hidden absolute top-0 left-1/2 w-0.5 h-[54px] bg-muted-foreground/20 transform -translate-y-full" />
                        </div>
                        <Card className="flex-grow ml-4">
                            <CardContent className="py-0 flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    <div className="text-primary">
                                        {instruction.icon}
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