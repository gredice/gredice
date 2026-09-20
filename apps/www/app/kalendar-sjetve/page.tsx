import { Button } from '@gredice/ui/Button';
import { Container } from '@gredice/ui/Container';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import { StyledHtml } from '@gredice/ui/StyledHtml';
import Link from 'next/link';
import { RegionalCalendarTable } from '../../components/plants/RegionalCalendarTable';
import { PublicBreadcrumbs } from '../../components/shared/seo/PublicBreadcrumbs';
import {
    calendarActivities,
    calendarActivityKeys,
    calendarMonthNames,
} from '../../lib/plants/calendarActivities';
import {
    getRegionalCalendarData,
    getRegionalCalendarRelatedGuides,
} from '../../lib/plants/getRegionalCalendarData';
import { filterRegionalCalendarRows } from '../../lib/plants/regionalCalendar';
import { regionalCalendarRegion } from '../../lib/plants/regionalCalendarReviews';
import { createPublicMetadata } from '../../lib/seo/publicMetadata';
import { KnownPages } from '../../src/KnownPages';

function first(value: string | string[] | undefined) {
    return (Array.isArray(value) ? value[0] : value) ?? '';
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
    const rows = filterRegionalCalendarRows(calendar.rows, { month, activity });

    return (
        <Container maxWidth="lg">
            <Stack spacing={6} className="min-w-0">
                <PublicBreadcrumbs
                    items={[
                        { label: 'Naslovnica', href: KnownPages.Landing },
                        { label: 'Kalendar sjetve i sadnje' },
                    ]}
                />
                <PageHeader header="Kalendar sjetve i sadnje za kontinentalnu Hrvatsku" />
                <StyledHtml>
                    <p>
                        Kalendar ti pomaže odlučiti što planirati, ali konačan
                        termin određuju uvjeti u vrtu. U Zagrebu i Moslavini
                        proljeće, ljeto i jesen ne počinju svake godine jednako.
                        Prije sjetve provjeri temperaturu tla, prognozu,
                        odabranu sortu i uzgajaš li na otvorenom ili pod
                        zaštitom.
                    </p>
                    <h2>Četiri različita koraka</h2>
                    <p>
                        <strong>Sjetva u zaštićenom prostoru</strong> znači da
                        biljku započinješ u uvjetima koje možeš bolje
                        kontrolirati. To još nije termin sadnje na otvorenu
                        gredicu.
                    </p>
                    <p>
                        <strong>Izravna sjetva</strong> znači da sjeme stavljaš
                        na mjesto gdje će biljka rasti. Važni su pripremljeno
                        tlo i uvjeti za nicanje.
                    </p>
                    <p>
                        <strong>Presađivanje</strong> je premještanje razvijene
                        mlade biljke na njezino mjesto u vrtu. Presadnica i
                        sjeme iste kulture zato ne moraju imati isti jesenski
                        rok.
                    </p>
                    <p>
                        <strong>Berba</strong> označava razdoblje kada bi usjev
                        mogao biti spreman, ovisno o početku uzgoja i njegovu
                        napretku. Datum u kalendaru nije potvrda da je konkretna
                        biljka zrela.
                    </p>
                    <p>
                        Kod češnjaka sadnja češnjeva ima zasebnu oznaku: nije
                        sjetva sjemena ni presađivanje presadnica.
                    </p>
                    <h2 id="tablica">Kako čitati tablicu</h2>
                    <p>
                        Odaberi mjesec i pogledaj koju radnju planiraš. Otvori
                        stranicu biljke za detalje o sorti, razmaku i njezi.
                        Prazno polje znači da u ovom kalendaru za tu kombinaciju
                        nemamo preporuku; ne znači automatski da je uzgoj
                        nemoguć u svim uvjetima.
                    </p>
                    <p>
                        Regija: <strong>{regionalCalendarRegion}</strong>.
                        Termini ovise o sorti i uvjetima uzgoja.
                    </p>
                    {!calendar.ready && (
                        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
                            Regionalna provjera kalendara još nije dovršena. Za
                            biljke bez aktualne provjere uzgajivača termini
                            ostaju nenavedeni. Dostupnost za narudžbu možeš
                            provjeriti zasebno u nastavku.
                        </p>
                    )}
                </StyledHtml>
                <form
                    action={`${KnownPages.SowingCalendar}#tablica`}
                    method="get"
                    className="flex flex-wrap items-end gap-3"
                >
                    <div className="flex flex-col gap-1 text-sm font-medium">
                        <label htmlFor="calendar-month">Mjesec</label>
                        <select
                            id="calendar-month"
                            name="mjesec"
                            defaultValue={month}
                            className="rounded-md border bg-background px-3 py-2"
                        >
                            <option value="">Svi mjeseci</option>
                            {calendarMonthNames.map((name, index) => (
                                <option key={name} value={index + 1}>
                                    {name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex min-w-0 flex-col gap-1 text-sm font-medium">
                        <label htmlFor="calendar-activity">Radnja</label>
                        <select
                            id="calendar-activity"
                            name="radnja"
                            defaultValue={activity}
                            className="max-w-full rounded-md border bg-background px-3 py-2"
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
                    <Button type="submit">Prikaži</Button>
                    <Link
                        href={`${KnownPages.SowingCalendar}#tablica`}
                        className="py-2 text-sm text-primary underline"
                    >
                        Prikaži sve
                    </Link>
                </form>
                <RegionalCalendarTable rows={rows} />
                <StyledHtml>
                    <h2>Izvori i provjera termina</h2>
                    <p>
                        Termine pregledavamo s uzgajivačem prije svake sezone
                        uzgoja. Uz pregledanu biljku navodimo stvarni datum
                        provjere, izvore i uvjete na koje se preporuka odnosi.
                        Datum promjene stranice nije datum agronomske provjere.
                    </p>
                    {calendar.crops.map((crop) => (
                        <section key={crop.plantId}>
                            <h3>
                                <Link href={KnownPages.Plant(crop.slug)}>
                                    {crop.name}
                                </Link>
                            </h3>
                            {crop.review ? (
                                <>
                                    <p>
                                        Regija: {crop.review.region}.
                                        Pregledao/la:{' '}
                                        {crop.review.reviewer.name},{' '}
                                        {crop.review.reviewer.role}. Zadnja
                                        sadržajna provjera:{' '}
                                        <time dateTime={crop.review.reviewedAt}>
                                            {crop.review.reviewedAt}
                                        </time>
                                        . Sljedeća provjera prije:{' '}
                                        <time
                                            dateTime={crop.review.reviewBefore}
                                        >
                                            {crop.review.reviewBefore}
                                        </time>
                                        .
                                    </p>
                                    <ul>
                                        {crop.rows.map((row) => (
                                            <li key={row.key}>
                                                <strong>{row.label}</strong>:{' '}
                                                {row.environment}.{' '}
                                                {row.varietyNotes}
                                            </li>
                                        ))}
                                    </ul>
                                    <ul>
                                        {crop.review.sources.map((source) => (
                                            <li key={source.url}>
                                                <a href={source.url}>
                                                    {source.label}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            ) : (
                                <p>
                                    {crop.status === 'changed'
                                        ? 'Podaci su promijenjeni nakon provjere; termini čekaju novu provjeru.'
                                        : crop.status === 'expired'
                                          ? 'Potrebna je nova sezonska provjera termina.'
                                          : 'Regionalni termini i datum provjere uzgajivača još nisu potvrđeni.'}
                                </p>
                            )}
                        </section>
                    ))}
                    <h2>Planiraj i ono što dolazi poslije</h2>
                    <p>
                        U maloj gredici nije važno samo što sadiš danas nego i
                        koliko dugo će zauzimati prostor. Nakon berbe jedne
                        kulture možeš razmotriti drugu, ako joj preostali dio
                        sezone odgovara. Zapiši prethodnu biljku, datum berbe i
                        stanje tla prije novog plana.
                    </p>
                    <h2>Kalendar i dostupnost u Gredicama</h2>
                    <p>
                        Kalendar prikazuje smjernice za uzgoj. Ponuda u
                        aplikaciji dodatno ovisi o raspoloživim biljkama i
                        mogućnostima izvedbe na farmi. Prije narudžbe provjeri
                        aktualan odabir i termin.
                    </p>
                    <h3>Dostupno za narudžbu u Gredicama</h3>
                    <ul>
                        {calendar.crops.map((crop) => (
                            <li key={crop.plantId}>
                                <strong>{crop.name}</strong>:{' '}
                                {crop.availableSorts.length ? (
                                    <>
                                        {crop.availableSorts.map(
                                            (sort, index) => (
                                                <span key={sort.id}>
                                                    {index > 0 && ', '}
                                                    <Link
                                                        href={KnownPages.PlantSort(
                                                            crop.slug,
                                                            sort.name,
                                                        )}
                                                    >
                                                        {sort.name}
                                                    </Link>
                                                </span>
                                            ),
                                        )}
                                        .
                                    </>
                                ) : (
                                    <>
                                        Provjeri aktualnu ponudu na{' '}
                                        <Link
                                            href={KnownPages.Plant(crop.slug)}
                                        >
                                            stranici biljke
                                        </Link>
                                        ; dostupna sorta s cijenom trenutačno
                                        nije potvrđena.
                                    </>
                                )}
                            </li>
                        ))}
                    </ul>
                    <p>
                        Prikaz prati aktualnu ponudu sorti i cijena. Dostupna
                        sorta nije potvrda da je sada preporučeni regionalni
                        termin uzgoja.
                    </p>
                    <p>
                        <Link href={KnownPages.Plants}>
                            Pogledaj što možeš posaditi
                        </Link>
                    </p>
                    {relatedGuides.length > 0 && (
                        <>
                            <h2>Povezani vodiči</h2>
                            <ul>
                                {relatedGuides.map((guide) => (
                                    <li key={guide.slug}>
                                        <a href={`/${guide.slug}`}>
                                            {guide.title}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </StyledHtml>
            </Stack>
        </Container>
    );
}
