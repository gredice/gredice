import { clientPublic } from '@gredice/client';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Container } from '@gredice/ui/Container';
import { Timer } from '@gredice/ui/icons';
import { LocalDateTime, TimeRange } from '@gredice/ui/LocalDateTime';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { StyledHtml } from '@gredice/ui/StyledHtml';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import { FeedbackModal } from '../../../components/shared/feedback/FeedbackModal';
import { WhatsAppCard } from '../../../components/social/WhatsAppCard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
    title: 'Termini dostave',
    description: 'Vidi dostupne termine za dostavu ili osobno preuzimanje.',
};

// Types from API response - these match the type-safe client schema
interface TimeSlot {
    id: number;
    locationId: number;
    type: 'delivery' | 'pickup';
    startAt: string;
    endAt: string;
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

// Fetch slots using type-safe client
async function fetchTimeSlots(
    type: 'delivery' | 'pickup',
): Promise<TimeSlot[]> {
    const fromDate = new Date();
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + 14);

    try {
        const response = await clientPublic().api.delivery.slots.$get({
            query: {
                type,
                from: fromDate.toISOString(),
                to: toDate.toISOString(),
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

// Group slots by date for better display
function groupSlotsByDate(slots: TimeSlot[]) {
    const grouped = slots.reduce(
        (acc, slot) => {
            const date = new Date(slot.startAt).toDateString();
            if (!acc[date]) {
                acc[date] = [];
            }
            acc[date].push(slot);
            return acc;
        },
        {} as Record<string, TimeSlot[]>,
    );

    // Sort dates
    return Object.keys(grouped)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
        .reduce(
            (acc, date) => {
                acc[date] = grouped[date].sort(
                    (a: TimeSlot, b: TimeSlot) =>
                        new Date(a.startAt).getTime() -
                        new Date(b.startAt).getTime(),
                );
                return acc;
            },
            {} as Record<string, TimeSlot[]>,
        );
}

async function SlotsDisplay({ type }: { type: 'delivery' | 'pickup' }) {
    const slots = await fetchTimeSlots(type);
    const groupedSlots = groupSlotsByDate(slots);

    if (Object.keys(groupedSlots).length === 0) {
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
                            Trenutno nema dostupnih termina za{' '}
                            {type === 'delivery'
                                ? 'dostavu'
                                : 'osobno preuzimanje'}{' '}
                            u sljedećih 14 dana.
                        </Typography>
                    </Stack>
                </CardContent>
            </Card>
        );
    }

    return (
        <Stack spacing={4}>
            {Object.entries(groupedSlots).map(([date, dateSlots]) => (
                <Card key={date} className="border-tertiary border-b-4">
                    <CardHeader>
                        <CardTitle>
                            <Typography
                                level="h5"
                                className="text-xl font-normal"
                            >
                                <LocalDateTime
                                    time={false}
                                    format={{
                                        weekday: 'long',
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric',
                                    }}
                                >
                                    {new Date(date)}
                                </LocalDateTime>
                            </Typography>
                        </CardTitle>
                    </CardHeader>
                    <CardContent noHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {dateSlots.map((slot) => {
                                return (
                                    <div
                                        key={slot.id}
                                        className="border rounded-lg p-3 bg-background"
                                    >
                                        <Stack spacing={4}>
                                            <Row spacing={2}>
                                                <Timer className="size-5 shrink-0 text-tertiary-foreground" />
                                                <Typography
                                                    level="body2"
                                                    semiBold
                                                >
                                                    <TimeRange
                                                        startAt={slot.startAt}
                                                        endAt={slot.endAt}
                                                        timeOnly
                                                    />
                                                </Typography>
                                            </Row>
                                            {slot.location &&
                                                slot.type === 'pickup' && (
                                                    <Typography
                                                        level="body3"
                                                        className="text-muted-foreground"
                                                    >
                                                        📍 {slot.location.name}
                                                    </Typography>
                                                )}
                                        </Stack>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
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
                    subHeader="Vidi dostupne termine za dostavu ili osobno preuzimanje."
                />

                <Typography level="body1">
                    Ovdje možeš vidjeti sve dostupne termine za dostavu ili
                    osobno preuzimanje u sljedećih 14 dana. Termin možeš
                    rezervirati u <strong>aplikaciji</strong> tijekom narudžbe
                    branja.
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
                        Termini dostave na adresu
                    </Typography>
                    <Typography level="body2" className="text-muted-foreground">
                        Dostava se vrši u 2-satnim blokovima na područje Zagreba
                        i okolice.
                    </Typography>
                    <SlotsDisplay type="delivery" />
                </Stack>
                <Stack spacing={4}>
                    <Typography level="h4">
                        Termini osobnog preuzimanja
                    </Typography>
                    <Typography level="body2" className="text-muted-foreground">
                        Osobno preuzimanje na našim lokacijama u Zagrebu.
                    </Typography>
                    <SlotsDisplay type="pickup" />
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
