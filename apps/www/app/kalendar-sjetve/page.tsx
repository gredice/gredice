import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { Container } from '@gredice/ui/Container';
import {
    GameCalendarIcon,
    GameCloudIcon,
    GameGardenPlanIcon,
    GameHarvestIcon,
    GameInformationIcon,
    GameJournalIcon,
    GameLocationIcon,
    GameRaisedBedSimpleIcon,
    GameSeedlingIcon,
    GameSeedPacketIcon,
    GameShovelIcon,
    GameSowingDepthIcon,
    GameThermometerIcon,
} from '@gredice/ui/GameIcons';
import { PageHeader } from '@gredice/ui/PageHeader';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { RegionalCalendarStatusChip } from '../../components/plants/RegionalCalendarStatusChip';
import {
    RegionalCalendarLegend,
    RegionalCalendarTable,
} from '../../components/plants/RegionalCalendarTable';
import { Card } from '../../components/shared/Card';
import { PublicBreadcrumbs } from '../../components/shared/seo/PublicBreadcrumbs';
import { PublicGardenIllustration } from '../../components/visuals/PublicGardenIllustration';
import {
    type CalendarActivity,
    calendarActivities,
    calendarActivityKeys,
    calendarMonthNames,
} from '../../lib/plants/calendarActivities';
import {
    getRegionalCalendarData,
    getRegionalCalendarRelatedGuides,
} from '../../lib/plants/getRegionalCalendarData';
import {
    filterRegionalCalendarRows,
    type RegionalCalendarCrop,
} from '../../lib/plants/regionalCalendar';
import { regionalCalendarRegion } from '../../lib/plants/regionalCalendarReviews';
import { createPublicMetadata } from '../../lib/seo/publicMetadata';
import { KnownPages } from '../../src/KnownPages';

const activitySteps = {
    propagating: {
        icon: GameSeedlingIcon,
        description:
            'Biljku započinješ u uvjetima koje možeš bolje kontrolirati. To još nije termin sadnje na otvorenu gredicu.',
    },
    sowing: {
        icon: GameSowingDepthIcon,
        description:
            'Sjeme stavljaš na mjesto gdje će biljka rasti. Važni su pripremljeno tlo i uvjeti za nicanje.',
    },
    planting: {
        icon: GameShovelIcon,
        description:
            'Razvijenu mladu biljku premještaš na njezino mjesto u vrtu. Presadnica i sjeme iste kulture zato ne moraju imati isti jesenski rok.',
    },
    harvest: {
        icon: GameHarvestIcon,
        description:
            'Razdoblje kada bi usjev mogao biti spreman, ovisno o početku uzgoja i njegovu napretku. Datum u kalendaru nije potvrda da je konkretna biljka zrela.',
    },
} satisfies Record<
    CalendarActivity,
    { icon: typeof GameSeedlingIcon; description: string }
>;

const beforeSowingChecks = [
    { icon: GameThermometerIcon, label: 'Temperaturu tla' },
    { icon: GameCloudIcon, label: 'Vremensku prognozu' },
    { icon: GameSeedPacketIcon, label: 'Odabranu sortu' },
    { icon: GameRaisedBedSimpleIcon, label: 'Otvoreno ili pod zaštitom' },
];

const statusDescriptions = {
    changed:
        'Podaci su promijenjeni nakon provjere; termini čekaju novu provjeru.',
    expired: 'Potrebna je nova sezonska provjera termina.',
    incomplete:
        'Regionalni termini i datum provjere uzgajivača još nisu potvrđeni.',
    missing:
        'Regionalni termini i datum provjere uzgajivača još nisu potvrđeni.',
};

function first(value: string | string[] | undefined) {
    return (Array.isArray(value) ? value[0] : value) ?? '';
}

function SectionHeading({
    icon,
    children,
}: {
    icon: ReactNode;
    children: ReactNode;
}) {
    return (
        <Row spacing={3}>
            <span aria-hidden className="shrink-0 [&>svg]:size-9">
                {icon}
            </span>
            <Typography level="h4" component="h2" semiBold>
                {children}
            </Typography>
        </Row>
    );
}

function CardLabel({ children }: { children: ReactNode }) {
    return (
        <Typography
            level="body3"
            component="p"
            semiBold
            uppercase
            className="tracking-wide"
        >
            {children}
        </Typography>
    );
}

function RegionalCalendarCropItem({ crop }: { crop: RegionalCalendarCrop }) {
    return (
        <li className="grid gap-4 p-4 md:grid-cols-[11rem_1fr_1fr] md:gap-6">
            <Row spacing={3} alignItems="start">
                <PlantOrSortImage
                    plant={{
                        image: crop.image,
                        information: { name: crop.name },
                    }}
                    alt=""
                    width={40}
                    height={40}
                    className="size-10 shrink-0"
                />
                <Stack spacing={1} alignItems="start" className="min-w-0">
                    <Typography level="h6" component="h3" semiBold>
                        <Link
                            href={KnownPages.Plant(crop.slug)}
                            className="hover:underline"
                        >
                            {crop.name}
                        </Link>
                    </Typography>
                    <RegionalCalendarStatusChip status={crop.status} />
                </Stack>
            </Row>
            <Stack spacing={2}>
                <CardLabel>Provjera termina</CardLabel>
                {crop.review ? (
                    <Stack spacing={2}>
                        <Typography level="body2">
                            Regija: {crop.review.region}. Pregledao/la:{' '}
                            {crop.review.reviewer.name},{' '}
                            {crop.review.reviewer.role}. Zadnja sadržajna
                            provjera:{' '}
                            <time dateTime={crop.review.reviewedAt}>
                                {crop.review.reviewedAt}
                            </time>
                            . Sljedeća provjera prije:{' '}
                            <time dateTime={crop.review.reviewBefore}>
                                {crop.review.reviewBefore}
                            </time>
                            .
                        </Typography>
                        <ul className="list-disc space-y-1 pl-5 text-sm">
                            {crop.rows.map((row) => (
                                <li key={row.key}>
                                    <strong>{row.label}</strong>:{' '}
                                    {row.environment}. {row.varietyNotes}
                                </li>
                            ))}
                        </ul>
                        <ul className="list-disc space-y-1 pl-5 text-sm">
                            {crop.review.sources.map((source) => (
                                <li key={source.url}>
                                    <a
                                        href={source.url}
                                        className="text-primary underline"
                                    >
                                        {source.label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </Stack>
                ) : (
                    <Typography level="body2">
                        {crop.status === 'reviewed'
                            ? statusDescriptions.missing
                            : statusDescriptions[crop.status]}
                    </Typography>
                )}
            </Stack>
            <Stack spacing={2}>
                <CardLabel>Dostupno za narudžbu u Gredicama</CardLabel>
                {crop.availableSorts.length ? (
                    <ul className="flex flex-wrap gap-1.5">
                        {crop.availableSorts.map((sort) => (
                            <li key={sort.id}>
                                <Chip
                                    size="sm"
                                    variant="outlined"
                                    href={KnownPages.PlantSort(
                                        crop.slug,
                                        sort.name,
                                    )}
                                >
                                    {sort.name}
                                </Chip>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <Typography level="body2">
                        Provjeri aktualnu ponudu na{' '}
                        <Link
                            href={KnownPages.Plant(crop.slug)}
                            className="text-primary underline"
                        >
                            stranici biljke
                        </Link>
                        ; dostupna sorta s cijenom trenutačno nije potvrđena.
                    </Typography>
                )}
            </Stack>
        </li>
    );
}

export async function generateMetadata({
    searchParams,
}: PageProps<'/kalendar-sjetve'>) {
    const [params, calendar] = await Promise.all([
        searchParams,
        getRegionalCalendarData(),
    ]);
    return createPublicMetadata({
        title: 'Kalendar sjetve i sadnje za kontinentalnu Hrvatsku',
        description:
            'Planiraj sjetvu, presađivanje i berbu povrća po mjesecima. Kalendar za kontinentalnu Hrvatsku uz objašnjenja sorti, uvjeta uzgoja i sezone.',
        path: KnownPages.SowingCalendar,
        category: 'Planiranje vrta',
        robots: {
            index: calendar.ready && !Object.keys(params).length,
            follow: true,
        },
    });
}

export default async function SowingCalendarPage({
    searchParams,
}: PageProps<'/kalendar-sjetve'>) {
    const [params, calendar, relatedGuides] = await Promise.all([
        searchParams,
        getRegionalCalendarData(),
        getRegionalCalendarRelatedGuides(),
    ]);
    const requestedMonth = first(params.mjesec);
    const month = /^(?:[1-9]|1[0-2])$/.test(requestedMonth)
        ? requestedMonth
        : '';
    const activity =
        calendarActivityKeys.find((key) => key === first(params.radnja)) ?? '';
    const filteredCrops = calendar.crops.map((crop) => ({
        ...crop,
        rows: filterRegionalCalendarRows(crop.rows, { month, activity }),
    }));
    const currentMonth = Number(
        new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/Zagreb',
            month: 'numeric',
        }).format(new Date()),
    );
    const reviewedCount = calendar.crops.filter(
        (crop) => crop.status === 'reviewed',
    ).length;

    return (
        <Container maxWidth="lg">
            <Stack spacing={12} className="min-w-0">
                <Stack spacing={4} className="min-w-0">
                    <PublicBreadcrumbs
                        items={[
                            { label: 'Naslovnica', href: KnownPages.Landing },
                            { label: 'Kalendar sjetve i sadnje' },
                        ]}
                    />
                    <PageHeader
                        header="Kalendar sjetve i sadnje za kontinentalnu Hrvatsku"
                        subHeader="Što i kada planirati u vrtu: sjetva, presađivanje i berba po mjesecima, uz objašnjenje svake radnje."
                        visual={
                            <PublicGardenIllustration
                                kind="sowing"
                                loading="eager"
                            />
                        }
                        headerChildren={
                            <Row spacing={2} className="flex-wrap gap-y-2">
                                <Chip
                                    variant="outlined"
                                    startDecorator={
                                        <GameLocationIcon aria-hidden />
                                    }
                                >
                                    {regionalCalendarRegion}
                                </Chip>
                                <Chip
                                    variant="outlined"
                                    startDecorator={
                                        <GameCalendarIcon aria-hidden />
                                    }
                                    href="#tablica"
                                >
                                    Otvori kalendar
                                </Chip>
                            </Row>
                        }
                    />
                </Stack>

                <div className="grid gap-6 md:grid-cols-[3fr_2fr] md:items-start">
                    <Stack spacing={3}>
                        <Typography level="body1" className="text-pretty">
                            Kalendar ti pomaže odlučiti što planirati, ali
                            konačan termin određuju uvjeti u vrtu. U Zagrebu i
                            Moslavini proljeće, ljeto i jesen ne počinju svake
                            godine jednako.
                        </Typography>
                        <Typography level="body2" className="text-pretty">
                            Termini ovise o sorti i uvjetima uzgoja. Kod
                            češnjaka sadnja češnjeva ima zasebnu oznaku: nije
                            sjetva sjemena ni presađivanje presadnica.
                        </Typography>
                    </Stack>
                    <Card className="p-4">
                        <Stack spacing={3}>
                            <CardLabel>Prije sjetve provjeri</CardLabel>
                            <ul className="grid grid-cols-2 gap-3">
                                {beforeSowingChecks.map(
                                    ({ icon: Icon, label }) => (
                                        <li
                                            key={label}
                                            className="flex items-center gap-2 text-sm"
                                        >
                                            <Icon
                                                aria-hidden
                                                className="size-8 shrink-0"
                                            />
                                            {label}
                                        </li>
                                    ),
                                )}
                            </ul>
                        </Stack>
                    </Card>
                </div>

                <Stack spacing={5}>
                    <SectionHeading icon={<GameJournalIcon aria-hidden />}>
                        Četiri različita koraka
                    </SectionHeading>
                    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {calendarActivityKeys.map((key) => {
                            const step = activitySteps[key];
                            const Icon = step.icon;
                            return (
                                <li key={key} className="flex">
                                    <Card className="flex w-full flex-col gap-3 p-4">
                                        <Row
                                            justifyContent="space-between"
                                            alignItems="start"
                                        >
                                            <Icon
                                                aria-hidden
                                                className="size-12"
                                            />
                                            <span
                                                aria-hidden
                                                className={cx(
                                                    'mt-1 h-2.5 w-8 rounded-full',
                                                    calendarActivities[key]
                                                        .color,
                                                )}
                                            />
                                        </Row>
                                        <Typography
                                            level="h6"
                                            component="h3"
                                            semiBold
                                        >
                                            {calendarActivities[key].name}
                                        </Typography>
                                        <Typography
                                            level="body2"
                                            className="text-pretty"
                                        >
                                            {step.description}
                                        </Typography>
                                    </Card>
                                </li>
                            );
                        })}
                    </ul>
                </Stack>

                <Stack
                    spacing={5}
                    className="min-w-0 scroll-mt-24"
                    id="tablica"
                >
                    <Stack spacing={2}>
                        <SectionHeading icon={<GameCalendarIcon aria-hidden />}>
                            Kalendar po mjesecima
                        </SectionHeading>
                        <Typography
                            level="body2"
                            className="max-w-prose text-pretty"
                        >
                            Odaberi mjesec i pogledaj koju radnju planiraš.
                            Otvori stranicu biljke za detalje o sorti, razmaku i
                            njezi. Prazno polje znači da u ovom kalendaru za tu
                            kombinaciju nemamo preporuku; ne znači automatski da
                            je uzgoj nemoguć u svim uvjetima.
                        </Typography>
                    </Stack>
                    {!calendar.ready && (
                        <Alert
                            color="warning"
                            role="note"
                            startDecorator={
                                <GameInformationIcon
                                    aria-hidden
                                    className="size-8"
                                />
                            }
                        >
                            <p>
                                <strong>
                                    Regionalna provjera kalendara još nije
                                    dovršena
                                </strong>{' '}
                                ({reviewedCount} od {calendar.crops.length}{' '}
                                kultura). Za biljke bez aktualne provjere
                                uzgajivača termini ostaju nenavedeni. Dostupnost
                                za narudžbu možeš provjeriti zasebno u nastavku.
                            </p>
                        </Alert>
                    )}
                    <Stack spacing={3} className="min-w-0">
                        <form
                            action={`${KnownPages.SowingCalendar}#tablica`}
                            method="get"
                            className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3 shadow-xs"
                        >
                            <div className="flex min-w-0 flex-1 basis-36 flex-col gap-1 text-sm font-medium">
                                <label htmlFor="calendar-month">Mjesec</label>
                                <select
                                    id="calendar-month"
                                    name="mjesec"
                                    defaultValue={month}
                                    className="h-10 w-full rounded-md border bg-field px-3"
                                >
                                    <option value="">Svi mjeseci</option>
                                    {calendarMonthNames.map((name, index) => (
                                        <option key={name} value={index + 1}>
                                            {name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex min-w-0 flex-[2] basis-56 flex-col gap-1 text-sm font-medium">
                                <label htmlFor="calendar-activity">
                                    Radnja
                                </label>
                                <select
                                    id="calendar-activity"
                                    name="radnja"
                                    defaultValue={activity}
                                    className="h-10 w-full rounded-md border bg-field px-3"
                                >
                                    <option value="">Sve radnje</option>
                                    {calendarActivityKeys.map((key) => (
                                        <option key={key} value={key}>
                                            {key === 'sowing'
                                                ? 'Izravna sjetva / sadnja češnjeva'
                                                : calendarActivities[key].name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <Row spacing={3}>
                                <Button type="submit" className="h-10">
                                    Prikaži
                                </Button>
                                <Link
                                    href={`${KnownPages.SowingCalendar}#tablica`}
                                    className="px-1 py-2 text-sm text-primary underline"
                                >
                                    Prikaži sve
                                </Link>
                            </Row>
                        </form>
                        <RegionalCalendarLegend />
                    </Stack>
                    <RegionalCalendarTable
                        crops={filteredCrops}
                        currentMonth={currentMonth}
                        selectedMonth={month ? Number(month) : undefined}
                    />
                </Stack>

                <Stack spacing={5}>
                    <Stack spacing={2}>
                        <SectionHeading
                            icon={<GameSeedPacketIcon aria-hidden />}
                        >
                            Izvori, provjera i dostupnost
                        </SectionHeading>
                        <Typography
                            level="body2"
                            className="max-w-prose text-pretty"
                        >
                            Termine pregledavamo s uzgajivačem prije svake
                            sezone uzgoja. Uz pregledanu biljku navodimo stvarni
                            datum provjere, izvore i uvjete na koje se preporuka
                            odnosi. Datum promjene stranice nije datum
                            agronomske provjere.
                        </Typography>
                        <Typography
                            level="body2"
                            className="max-w-prose text-pretty"
                        >
                            Kalendar prikazuje smjernice za uzgoj, a ponuda u
                            aplikaciji dodatno ovisi o raspoloživim biljkama i
                            mogućnostima izvedbe na farmi. Prikaz prati aktualnu
                            ponudu sorti i cijena, ali dostupna sorta nije
                            potvrda da je sada preporučeni regionalni termin
                            uzgoja. Prije narudžbe provjeri aktualan odabir i
                            termin.
                        </Typography>
                    </Stack>
                    <Card className="p-0">
                        <ul className="divide-y">
                            {calendar.crops.map((crop) => (
                                <RegionalCalendarCropItem
                                    key={crop.plantId}
                                    crop={crop}
                                />
                            ))}
                        </ul>
                    </Card>
                </Stack>

                <Card className="p-5 md:p-6">
                    <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
                        <GameGardenPlanIcon
                            aria-hidden
                            className="size-20 md:size-24"
                        />
                        <Stack spacing={3} alignItems="start">
                            <Typography level="h5" component="h2" semiBold>
                                Planiraj i ono što dolazi poslije
                            </Typography>
                            <Typography
                                level="body2"
                                className="max-w-prose text-pretty"
                            >
                                U maloj gredici nije važno samo što sadiš danas
                                nego i koliko dugo će zauzimati prostor. Nakon
                                berbe jedne kulture možeš razmotriti drugu, ako
                                joj preostali dio sezone odgovara. Zapiši
                                prethodnu biljku, datum berbe i stanje tla prije
                                novog plana.
                            </Typography>
                            <Button href={KnownPages.Plants}>
                                Pogledaj što možeš posaditi
                            </Button>
                        </Stack>
                    </div>
                </Card>

                {relatedGuides.length > 0 && (
                    <Stack spacing={4}>
                        <Typography level="h5" component="h2" semiBold>
                            Povezani vodiči
                        </Typography>
                        <ul className="grid gap-3 sm:grid-cols-2">
                            {relatedGuides.map((guide) => (
                                <li key={guide.slug}>
                                    <a
                                        href={`/${guide.slug}`}
                                        className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm font-medium shadow-xs hover:bg-accent"
                                    >
                                        <GameJournalIcon
                                            aria-hidden
                                            className="size-8 shrink-0"
                                        />
                                        {guide.title}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </Stack>
                )}
            </Stack>
        </Container>
    );
}
