import { clientPublic } from '@gredice/client';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Container } from '@gredice/ui/Container';
import { MapPin, Truck } from '@gredice/ui/icons';
import { LocalDateTime, TimeRange } from '@gredice/ui/LocalDateTime';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { StyledHtml } from '@gredice/ui/StyledHtml';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import type { Metadata } from 'next';
import { FeedbackModal } from '../../../components/shared/feedback/FeedbackModal';
import { WhatsAppCard } from '../../../components/social/WhatsAppCard';
import { ClosingSoonIndicator } from './ClosingSoonIndicator';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
    title: 'Termini dostave',
    description:
        'Vidi raspoložive i zatvorene termine za dostavu ili osobno preuzimanje u sljedećih mjesec dana.',
};

// Types from API response - these match the type-safe client schema
interface TimeSlot {
    id: number;
    locationId: number;
    type: 'delivery' | 'pickup';
    startAt: string;
    endAt: string;
    effectiveClosesAt: string;
    status: string;
    location?: {
        id: number;
        name: string;
        street1: string;
        street2?: string;
        city: string;
        postalCode: string;
    };
}

const SLOT_RANGE_DAYS = 30;
const DELIVERY_TIME_ZONE = 'Europe/Zagreb';
const deliveryDateKeyFormatter = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: DELIVERY_TIME_ZONE,
});

interface DaySlots {
    date: Date;
    slots: TimeSlot[];
}

interface WeekSlots {
    startAt: Date;
    endAt: Date;
    days: DaySlots[];
}

interface SlotRange {
    fromDate: Date;
    toDate: Date;
    referenceDate: Date;
}

function createSlotRange(): SlotRange {
    const referenceDate = new Date();
    const fromDate = startOfWeek(referenceDate);
    const toDate = new Date(referenceDate);
    toDate.setDate(toDate.getDate() + SLOT_RANGE_DAYS);

    return { fromDate, toDate, referenceDate };
}

async function fetchTimeSlots({
    fromDate,
    toDate,
}: SlotRange): Promise<TimeSlot[]> {
    try {
        const response = await clientPublic().api.delivery.slots.$get({
            query: {
                from: fromDate.toISOString(),
                to: toDate.toISOString(),
                includeClosed: 'true',
                includeArchived: 'true',
            },
        });

        if (!response.ok) {
            console.error('Failed to fetch slots:', response.status);
            return [];
        }

        const slots = await response.json();
        // Type assertion since we know the API contract matches our interface
        return slots as TimeSlot[];
    } catch (error) {
        console.error('Error fetching slots:', error);
        return [];
    }
}

function compareSlots(a: TimeSlot, b: TimeSlot) {
    const startDifference =
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime();

    if (startDifference !== 0) {
        return startDifference;
    }

    if (a.type !== b.type) {
        return a.type === 'delivery' ? -1 : 1;
    }

    return (a.location?.name ?? '').localeCompare(b.location?.name ?? '');
}

function dateKey(date: Date) {
    const parts = new Map(
        deliveryDateKeyFormatter
            .formatToParts(date)
            .map(({ type, value }) => [type, value]),
    );

    return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`;
}

function startOfWeek(date: Date) {
    const startAt = new Date(`${dateKey(date)}T12:00:00.000Z`);
    const daysFromMonday = (startAt.getUTCDay() + 6) % 7;
    startAt.setUTCDate(startAt.getUTCDate() - daysFromMonday);
    startAt.setUTCHours(0, 0, 0, 0);
    return startAt;
}

function groupSlotsByWeek(
    slots: TimeSlot[],
    { fromDate, toDate }: SlotRange,
): WeekSlots[] {
    const weeks = new Map<number, WeekSlots>();
    const finalWeekStart = startOfWeek(toDate);
    let weekStart = startOfWeek(fromDate);

    while (weekStart.getTime() <= finalWeekStart.getTime()) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weeks.set(weekStart.getTime(), {
            startAt: weekStart,
            endAt: weekEnd,
            days: [],
        });

        const nextWeekStart = new Date(weekStart);
        nextWeekStart.setDate(nextWeekStart.getDate() + 7);
        weekStart = nextWeekStart;
    }

    const days = new Map<string, DaySlots>();

    for (const slot of [...slots].sort(compareSlots)) {
        const date = new Date(slot.startAt);
        const key = dateKey(date);
        const day = days.get(key);

        if (day) {
            day.slots.push(slot);
        } else {
            days.set(key, { date, slots: [slot] });
        }
    }

    for (const day of days.values()) {
        const weekStart = startOfWeek(day.date);
        const weekKey = weekStart.getTime();
        const week = weeks.get(weekKey);

        if (week) {
            week.days.push(day);
        }
    }

    return [...weeks.values()]
        .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
        .map((week) => ({
            ...week,
            days: week.days.sort((a, b) => a.date.getTime() - b.date.getTime()),
        }));
}

function WeekRange({ startAt, endAt }: Pick<WeekSlots, 'startAt' | 'endAt'>) {
    const isSameMonth =
        startAt.getFullYear() === endAt.getFullYear() &&
        startAt.getMonth() === endAt.getMonth();
    const isSameYear = startAt.getFullYear() === endAt.getFullYear();
    const startFormat: Intl.DateTimeFormatOptions = {
        day: 'numeric',
        timeZone: DELIVERY_TIME_ZONE,
    };

    if (!isSameMonth) {
        startFormat.month = 'long';
    }

    if (!isSameYear) {
        startFormat.year = 'numeric';
    }

    return (
        <>
            <LocalDateTime time={false} format={startFormat}>
                {startAt}
            </LocalDateTime>{' '}
            –{' '}
            <LocalDateTime
                time={false}
                format={{
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    timeZone: DELIVERY_TIME_ZONE,
                }}
            >
                {endAt}
            </LocalDateTime>
        </>
    );
}

async function SlotsDisplay() {
    const range = createSlotRange();
    const slots = await fetchTimeSlots(range);
    const weeks = groupSlotsByWeek(slots, range);

    if (weeks.length === 0) {
        return (
            <Card className="p-6 border-tertiary border-b-4">
                <CardContent noHeader>
                    <Stack spacing={4} className="text-center">
                        <Typography level="h6">
                            Nema dostupnih termina
                        </Typography>
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            Trenutno nema termina za dostavu ili osobno
                            preuzimanje u sljedećih mjesec dana.
                        </Typography>
                    </Stack>
                </CardContent>
            </Card>
        );
    }

    return (
        <Stack spacing={5}>
            {weeks.map((week, weekIndex) => (
                <section key={week.startAt.toISOString()}>
                    <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <Typography level="h6" component="h5">
                            <span className="font-normal text-muted-foreground">
                                Tjedan{' '}
                            </span>
                            <WeekRange
                                startAt={week.startAt}
                                endAt={week.endAt}
                            />
                        </Typography>
                        {weekIndex === 0 && (
                            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground md:ml-auto md:justify-end">
                                <span className="inline-flex items-center gap-2">
                                    <Truck
                                        aria-hidden
                                        className="size-4 text-primary"
                                    />
                                    Dostava na adresu
                                </span>
                                <span className="inline-flex items-center gap-2">
                                    <MapPin
                                        aria-hidden
                                        className="size-4 text-tertiary-foreground"
                                    />
                                    Osobno preuzimanje
                                </span>
                            </div>
                        )}
                    </div>
                    <Card className="overflow-hidden border-tertiary border-b-4 p-0">
                        {week.days.length === 0 ? (
                            <div className="flex min-h-20 items-center justify-center p-5 text-center">
                                <Typography
                                    level="body2"
                                    className="text-muted-foreground"
                                >
                                    Nema planiranih ni otvorenih termina dostave
                                    ili osobnog preuzimanja za ovaj tjedan.
                                </Typography>
                            </div>
                        ) : (
                            week.days.map((day) => {
                                const isToday =
                                    dateKey(day.date) ===
                                    dateKey(range.referenceDate);

                                return (
                                    <div
                                        key={dateKey(day.date)}
                                        className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-3 border-b p-3 last:border-b-0 md:gap-4"
                                    >
                                        <div className="flex min-h-10 flex-col items-start justify-center text-left">
                                            <LocalDateTime
                                                className="text-sm font-bold uppercase tracking-wide text-foreground"
                                                time={false}
                                                format={{
                                                    weekday: 'short',
                                                    timeZone:
                                                        DELIVERY_TIME_ZONE,
                                                }}
                                            >
                                                {day.date}
                                            </LocalDateTime>
                                            <LocalDateTime
                                                className="whitespace-nowrap text-[0.65rem] font-normal text-muted-foreground"
                                                time={false}
                                                format={{
                                                    day: 'numeric',
                                                    month: 'short',
                                                    timeZone:
                                                        DELIVERY_TIME_ZONE,
                                                }}
                                            >
                                                {day.date}
                                            </LocalDateTime>
                                            {isToday && (
                                                <span className="mt-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase leading-none tracking-wide text-primary">
                                                    Danas
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap items-start gap-2">
                                            {day.slots.map((slot) => {
                                                const isClosed =
                                                    slot.status !== 'scheduled';
                                                const SlotIcon =
                                                    slot.type === 'delivery'
                                                        ? Truck
                                                        : MapPin;

                                                return (
                                                    <div
                                                        key={slot.id}
                                                        className={cx(
                                                            'inline-flex flex-col overflow-hidden rounded-md border',
                                                            isClosed
                                                                ? 'border-dashed bg-muted/60 text-muted-foreground'
                                                                : 'bg-background text-foreground',
                                                        )}
                                                    >
                                                        <div className="inline-flex min-h-9 items-center gap-2 px-2.5 py-1.5 text-sm">
                                                            <SlotIcon
                                                                aria-hidden
                                                                className={cx(
                                                                    'size-4 shrink-0',
                                                                    !isClosed &&
                                                                        slot.type ===
                                                                            'delivery' &&
                                                                        'text-primary',
                                                                    !isClosed &&
                                                                        slot.type ===
                                                                            'pickup' &&
                                                                        'text-tertiary-foreground',
                                                                )}
                                                            />
                                                            <TimeRange
                                                                className={cx(
                                                                    'font-medium tabular-nums',
                                                                    isClosed &&
                                                                        'line-through',
                                                                )}
                                                                startAt={
                                                                    slot.startAt
                                                                }
                                                                endAt={
                                                                    slot.endAt
                                                                }
                                                                timeOnly
                                                            />
                                                            {slot.type ===
                                                                'pickup' &&
                                                                slot.location && (
                                                                    <span className="border-l pl-2 text-xs">
                                                                        {
                                                                            slot
                                                                                .location
                                                                                .name
                                                                        }
                                                                    </span>
                                                                )}
                                                            {isClosed && (
                                                                <span className="border-l pl-2 text-[0.65rem] font-semibold uppercase tracking-wide">
                                                                    zatvoren
                                                                </span>
                                                            )}
                                                        </div>
                                                        {!isClosed && (
                                                            <ClosingSoonIndicator
                                                                effectiveClosesAt={
                                                                    slot.effectiveClosesAt
                                                                }
                                                            />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </Card>
                </section>
            ))}
        </Stack>
    );
}

export default async function DeliverySlotsPage() {
    return (
        <Container maxWidth="md">
            <Stack spacing={8}>
                <PageHeader
                    padded
                    header="📅 Termini dostave"
                    subHeader="Vidi termine za dostavu ili osobno preuzimanje u sljedećih mjesec dana."
                />

                <Typography level="body1">
                    Ovdje možeš vidjeti raspoložive i zatvorene termine za
                    dostavu ili osobno preuzimanje u sljedećih mjesec dana.
                    Raspoloživ termin možeš rezervirati u{' '}
                    <strong>aplikaciji</strong> tijekom narudžbe branja.
                </Typography>

                <Typography
                    level="body2"
                    className="text-muted-foreground italic"
                >
                    Napomena: planiraj dostavu barem 48 sati unaprijed kako bi
                    sve bilo spremno i dostavljeno na vrijeme. Termini unutar
                    dva dana mogu biti ograničeni.
                </Typography>

                <Card className="w-fit p-4 pr-12 border-tertiary border-b-4">
                    <CardHeader>
                        <CardTitle>💡 Kako rezervirati termin?</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <StyledHtml>
                            <ol>
                                <li>Dodaj barem jedno branje u košaricu</li>
                                <li>Potvrdi plaćanje</li>
                                <li>
                                    Odaberi način dostave i preferirani termin
                                </li>
                                <li>Završi narudžbu</li>
                            </ol>
                        </StyledHtml>
                    </CardContent>
                </Card>

                <Stack spacing={4}>
                    <Typography level="h4">
                        Termini dostave i preuzimanja
                    </Typography>
                    <Typography level="body2" className="text-muted-foreground">
                        Dostava se vrši u 2-satnim blokovima na području Zagreba
                        i okolice, a osobno preuzimanje na našim lokacijama u
                        Zagrebu.
                    </Typography>
                    <SlotsDisplay />
                </Stack>

                <Stack spacing={4}>
                    <Typography level="h6">
                        Potrebna ti je pomoć ili više informacija o dostavi?
                    </Typography>
                    <WhatsAppCard />
                </Stack>

                <Row spacing={4} className="mt-8">
                    <Typography level="body1">
                        Jesu li ti ove informacije korisne?
                    </Typography>
                    <FeedbackModal topic="www/delivery-slots" />
                </Row>
            </Stack>
        </Container>
    );
}
