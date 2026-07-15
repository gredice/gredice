import {
    calculatePlantsPerField,
    FIELD_SIZE_LABEL,
    getHarvestPlantRemovalDisclaimer,
} from '@gredice/js/plants';
import type { EntityStandardized } from '@gredice/storage';
import { Card, CardContent } from '@gredice/ui/Card';
import {
    ArrowDownToLine,
    Calendar,
    Check,
    Droplet,
    FileText,
    Globe,
    Info,
    Leaf,
    Ruler,
    ShoppingCart,
    Sprout,
    Store,
    Sun,
    SunMoon,
    Tally3,
    Thermometer,
    Timer,
} from '@gredice/ui/icons';
import { Markdown } from '@gredice/ui/Markdown';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { ReactNode } from 'react';
import { handbookMarkdownClassName } from '../handbookMarkdown';
import { getPlantSortLabel, getPlantSortPlant } from './plantUtils';

interface PlantSortDetailsProps {
    plantSort: EntityStandardized;
}

type DetailCardData = {
    key: string;
    title: string;
    value: ReactNode;
    icon: typeof Info;
};

type TextCardData = {
    key: string;
    title: string;
    text: string;
    icon: typeof Info;
};

const monthNames = [
    'siječanj',
    'veljača',
    'ožujak',
    'travanj',
    'svibanj',
    'lipanj',
    'srpanj',
    'kolovoz',
    'rujan',
    'listopad',
    'studeni',
    'prosinac',
];

const calendarDetails = [
    {
        key: 'propagating',
        title: 'Sjetva u zatvorenom',
        icon: Sprout,
    },
    {
        key: 'sowing',
        title: 'Sjetva na otvorenom',
        icon: Sprout,
    },
    {
        key: 'planting',
        title: 'Presađivanje',
        icon: Calendar,
    },
    {
        key: 'harvest',
        title: 'Berba',
        icon: Store,
    },
] satisfies Array<{
    key: string;
    title: string;
    icon: typeof Info;
}>;

const reproductionTypeLabels: Record<string, string> = {
    bulb: 'Lukovica',
    seed: 'Sjeme',
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function recordProperty(value: unknown, propertyName: string) {
    if (!isRecord(value)) {
        return null;
    }

    const propertyValue = value[propertyName];
    return isRecord(propertyValue) ? propertyValue : null;
}

function textProperty(value: unknown, propertyName: string) {
    if (!isRecord(value)) {
        return null;
    }

    const propertyValue = value[propertyName];
    return typeof propertyValue === 'string' && propertyValue.trim()
        ? propertyValue
        : null;
}

function numberProperty(value: Record<string, unknown> | null, key: string) {
    const propertyValue = value?.[key];
    return typeof propertyValue === 'number' && !Number.isNaN(propertyValue)
        ? propertyValue
        : null;
}

function stringProperty(value: Record<string, unknown> | null, key: string) {
    const propertyValue = value?.[key];
    return typeof propertyValue === 'string' && propertyValue.trim()
        ? propertyValue
        : null;
}

function booleanProperty(value: Record<string, unknown> | null, key: string) {
    const propertyValue = value?.[key];
    return typeof propertyValue === 'boolean' ? propertyValue : null;
}

function formatNumber(value: number) {
    return value.toLocaleString('hr-HR');
}

function formatDayRange(min: number | null, max: number | null) {
    if (min == null && max == null) {
        return null;
    }

    if (min != null && max != null) {
        if (min === max) {
            return `${formatNumber(min)} ${min === 1 ? 'dan' : 'dana'}`;
        }

        return `${formatNumber(min)}-${formatNumber(max)} dana`;
    }

    const value = min ?? max;
    return value == null
        ? null
        : `${formatNumber(value)} ${value === 1 ? 'dan' : 'dana'}`;
}

function formatWeightRange(min: number | null, max: number | null) {
    if (min == null && max == null) {
        return null;
    }

    if (min != null && max != null) {
        if (min === max) {
            return `${formatNumber(min)} g`;
        }

        return `${formatNumber(min)}-${formatNumber(max)} g`;
    }

    const value = min ?? max;
    return value == null ? null : `${formatNumber(value)} g`;
}

function formatLight(value: number | null) {
    if (value == null) {
        return null;
    }

    if (value >= 0.7) {
        return 'Sunce';
    }

    if (value >= 0.3) {
        return 'Polusjena';
    }

    return 'Hlad';
}

function formatMonthPoint(value: number) {
    const monthIndex = Math.floor(value) - 1;
    const monthName = monthNames[monthIndex];

    if (!monthName) {
        return formatNumber(value);
    }

    return value % 1 === 0 ? monthName : `sredina ${monthName}`;
}

function formatCalendarPeriod(value: unknown) {
    if (!isRecord(value)) {
        return null;
    }

    const start = numberProperty(value, 'start');
    const end = numberProperty(value, 'end');

    if (start == null && end == null) {
        return null;
    }

    if (start != null && end != null) {
        const formattedStart = formatMonthPoint(start);
        const formattedEnd = formatMonthPoint(end);
        return formattedStart === formattedEnd
            ? formattedStart
            : `${formattedStart} - ${formattedEnd}`;
    }

    return formatMonthPoint(start ?? end ?? 0);
}

function formatCalendarValue(value: unknown) {
    if (!Array.isArray(value)) {
        return null;
    }

    const periods = value
        .map((period) => formatCalendarPeriod(period))
        .filter((period): period is string => Boolean(period));

    if (periods.length === 0) {
        return null;
    }

    if (periods.length === 1) {
        return periods[0];
    }

    return (
        <ul className="list-disc space-y-1 pl-4">
            {periods.map((period) => (
                <li key={period}>{period}</li>
            ))}
        </ul>
    );
}

function DetailCard({
    children,
    icon: Icon,
    title,
}: {
    children: ReactNode;
    icon: typeof Info;
    title: string;
}) {
    return (
        <Card>
            <CardContent noHeader className="p-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="size-5" />
                    </span>
                    <Stack spacing={1} className="min-w-0 flex-1">
                        <Typography
                            level="body1"
                            semiBold
                            className="text-foreground"
                        >
                            {title}
                        </Typography>
                        {children}
                    </Stack>
                </div>
            </CardContent>
        </Card>
    );
}

function ValueCard({ card }: { card: DetailCardData }) {
    return (
        <DetailCard title={card.title} icon={card.icon}>
            <Typography
                level="body1"
                component="div"
                className="text-foreground"
            >
                {card.value}
            </Typography>
        </DetailCard>
    );
}

function TextCard({ card }: { card: TextCardData }) {
    return (
        <DetailCard title={card.title} icon={card.icon}>
            <Markdown
                className={`${handbookMarkdownClassName} prose-p:first:mt-0 prose-p:last:mb-0`}
            >
                {card.text}
            </Markdown>
        </DetailCard>
    );
}

function DetailSection({
    cards,
    title,
}: {
    cards: DetailCardData[];
    title: string;
}) {
    if (cards.length === 0) {
        return null;
    }

    return (
        <Stack spacing={2}>
            <Typography level="h6" semiBold>
                {title}
            </Typography>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cards.map((card) => (
                    <ValueCard key={card.key} card={card} />
                ))}
            </div>
        </Stack>
    );
}

function card(
    key: string,
    title: string,
    value: ReactNode | null | undefined,
    icon: typeof Info,
): DetailCardData | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    return { key, title, value, icon };
}

function buildTextCards(
    sortInformation: Record<string, unknown> | null,
    plantInformation: Record<string, unknown> | null,
) {
    const textFields = [
        { key: 'description', title: 'Opis', icon: FileText },
        { key: 'soilPreparation', title: 'Priprema tla', icon: Tally3 },
        { key: 'sowing', title: 'Sjetva', icon: Sprout },
        { key: 'planting', title: 'Sadnja', icon: Calendar },
        { key: 'growth', title: 'Rast', icon: SunMoon },
        { key: 'maintenance', title: 'Održavanje', icon: Check },
        { key: 'watering', title: 'Zalijevanje', icon: Droplet },
        { key: 'flowering', title: 'Cvatnja', icon: Leaf },
        { key: 'harvest', title: 'Berba', icon: Store },
        { key: 'storage', title: 'Čuvanje', icon: Info },
        { key: 'origin', title: 'Podrijetlo', icon: Globe },
    ] satisfies Array<{
        key: string;
        title: string;
        icon: typeof Info;
    }>;

    return textFields
        .map(({ key, title, icon }) => {
            const text =
                textProperty(sortInformation, key) ??
                textProperty(plantInformation, key);

            return text ? { key, title, text, icon } : null;
        })
        .filter((item): item is TextCardData => Boolean(item));
}

function buildSowingCards(attributes: Record<string, unknown> | null) {
    const seedingDistance = numberProperty(attributes, 'seedingDistance');
    const totalPlants =
        seedingDistance == null
            ? null
            : calculatePlantsPerField(seedingDistance).totalPlants;

    return [
        card(
            'plantsPerField',
            `Broj biljaka na ${FIELD_SIZE_LABEL}`,
            totalPlants == null ? null : formatNumber(totalPlants),
            Sprout,
        ),
        card(
            'seedingDistance',
            'Razmak sijanja/sadnje',
            seedingDistance == null
                ? null
                : `${formatNumber(seedingDistance)} cm`,
            Ruler,
        ),
        card(
            'seedingDepth',
            'Dubina sijanja',
            numberProperty(attributes, 'seedingDepth') == null
                ? null
                : `${formatNumber(numberProperty(attributes, 'seedingDepth') ?? 0)} cm`,
            ArrowDownToLine,
        ),
        card(
            'germinationType',
            'Klijanje',
            stringProperty(attributes, 'germinationType'),
            Sprout,
        ),
        card(
            'germinationTemperature',
            'Temperatura klijanja',
            numberProperty(attributes, 'gernimationTemperature') == null
                ? null
                : `${formatNumber(numberProperty(attributes, 'gernimationTemperature') ?? 0)} °C`,
            Thermometer,
        ),
        card(
            'germinationWindow',
            'Vrijeme klijanja',
            formatDayRange(
                numberProperty(attributes, 'germinationWindowMin'),
                numberProperty(attributes, 'germinationWindowMax'),
            ),
            Timer,
        ),
    ].filter((item): item is DetailCardData => Boolean(item));
}

function buildGrowthCards(attributes: Record<string, unknown> | null) {
    return [
        card(
            'light',
            'Svjetlost',
            formatLight(numberProperty(attributes, 'light')),
            Sun,
        ),
        card('soil', 'Zemlja', stringProperty(attributes, 'soil'), Tally3),
        card(
            'nutrients',
            'Nutrijenti',
            stringProperty(attributes, 'nutrients'),
            Leaf,
        ),
        card(
            'growthWindow',
            'Vrijeme rasta',
            formatDayRange(
                numberProperty(attributes, 'growthWindowMin'),
                numberProperty(attributes, 'growthWindowMax'),
            ),
            SunMoon,
        ),
    ].filter((item): item is DetailCardData => Boolean(item));
}

function buildWateringCards(attributes: Record<string, unknown> | null) {
    return [
        card('water', 'Voda', stringProperty(attributes, 'water'), Droplet),
    ].filter((item): item is DetailCardData => Boolean(item));
}

function buildHarvestCards(attributes: Record<string, unknown> | null) {
    const yieldMin = numberProperty(attributes, 'yieldMin');
    const yieldMax = numberProperty(attributes, 'yieldMax');
    const yieldType = stringProperty(attributes, 'yieldType');
    const yieldRange = formatWeightRange(yieldMin, yieldMax);
    const cleanHarvest = booleanProperty(attributes, 'cleanHarvest');

    return [
        card(
            'harvestWindow',
            'Vrijeme berbe',
            formatDayRange(
                numberProperty(attributes, 'harvestWindowMin'),
                numberProperty(attributes, 'harvestWindowMax'),
            ),
            Store,
        ),
        card(
            'yield',
            'Očekivani prinos',
            yieldRange
                ? `${yieldRange} ${yieldType === 'perPlant' ? 'po biljci' : 'po polju'}`
                : null,
            ShoppingCart,
        ),
        card(
            'cleanHarvest',
            'Nakon berbe',
            cleanHarvest == null
                ? null
                : getHarvestPlantRemovalDisclaimer(cleanHarvest),
            Check,
        ),
    ].filter((item): item is DetailCardData => Boolean(item));
}

function buildSortCards(attributes: Record<string, unknown> | null) {
    const reproductionType = stringProperty(attributes, 'reproductionType');

    return [
        card(
            'reproductionType',
            'Vrsta reprodukcije',
            reproductionType
                ? (reproductionTypeLabels[reproductionType] ?? reproductionType)
                : null,
            Sprout,
        ),
    ].filter((item): item is DetailCardData => Boolean(item));
}

function buildCalendarCards(calendar: Record<string, unknown> | null) {
    if (!calendar) {
        return [];
    }

    return calendarDetails
        .map(({ icon, key, title }) =>
            card(key, title, formatCalendarValue(calendar[key]), icon),
        )
        .filter((item): item is DetailCardData => Boolean(item));
}

export function PlantSortDetails({ plantSort }: PlantSortDetailsProps) {
    const plant = getPlantSortPlant(plantSort);
    const sortInformation = isRecord(plantSort.information)
        ? plantSort.information
        : null;
    const plantInformation = isRecord(plant?.information)
        ? plant.information
        : null;
    const plantAttributes = recordProperty(plant, 'attributes');
    const plantCalendar = recordProperty(plant, 'calendar');
    const sortAttributes = recordProperty(plantSort, 'attributes');
    const textCards = buildTextCards(sortInformation, plantInformation);
    const sortCards = buildSortCards(sortAttributes);
    const sowingCards = buildSowingCards(plantAttributes);
    const growthCards = buildGrowthCards(plantAttributes);
    const wateringCards = buildWateringCards(plantAttributes);
    const harvestCards = buildHarvestCards(plantAttributes);
    const calendarCards = buildCalendarCards(plantCalendar);
    const plantName = plant?.information?.name;
    const latinName = textProperty(plantInformation, 'latinName');

    return (
        <Stack spacing={4}>
            <DetailCard title="Biljka" icon={Sprout}>
                <div className="flex min-w-0 items-center gap-3">
                    <PlantOrSortImage
                        plantSort={plantSort}
                        width={48}
                        height={48}
                        className="size-12 shrink-0 rounded-md object-cover"
                    />
                    <Stack spacing={0} className="min-w-0">
                        <Typography level="body1" className="text-foreground">
                            {plantName ?? getPlantSortLabel(plantSort)}
                        </Typography>
                        {latinName && (
                            <Typography
                                level="body2"
                                className="text-muted-foreground"
                            >
                                {latinName}
                            </Typography>
                        )}
                    </Stack>
                </div>
            </DetailCard>

            {textCards.map((textCard) => (
                <TextCard key={textCard.key} card={textCard} />
            ))}

            <DetailSection title="Sorta" cards={sortCards} />
            <DetailSection title="Sjetva" cards={sowingCards} />
            <DetailSection title="Rast" cards={growthCards} />
            <DetailSection title="Zalijevanje" cards={wateringCards} />
            <DetailSection title="Berba" cards={harvestCards} />
            <DetailSection title="Kalendar uzgoja" cards={calendarCards} />
        </Stack>
    );
}
