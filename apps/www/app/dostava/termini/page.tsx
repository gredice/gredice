import { Stack } from "@signalco/ui-primitives/Stack";
import { Container } from "@signalco/ui-primitives/Container";
import { PageHeader } from "../../../components/shared/PageHeader";
import { Card } from "@signalco/ui-primitives/Card";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@signalco/ui-primitives/Tabs";
import { Row } from "@signalco/ui-primitives/Row";
import { Chip } from "@signalco/ui-primitives/Chip";
import { FeedbackModal } from "../../../components/shared/feedback/FeedbackModal";
import { WhatsAppCard } from "../../../components/social/WhatsAppCard";
import { client } from '@gredice/client';

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
async function fetchTimeSlots(type: 'delivery' | 'pickup'): Promise<TimeSlot[]> {
    const fromDate = new Date();
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + 14);

    try {
        const response = await client().api.delivery.slots.$get({
            query: {
                type,
                from: fromDate.toISOString(),
                to: toDate.toISOString()
            }
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
    const grouped = slots.reduce((acc, slot) => {
        const date = new Date(slot.startAt).toDateString();
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(slot);
        return acc;
    }, {} as Record<string, TimeSlot[]>);

    // Sort dates
    return Object.keys(grouped)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
        .reduce((acc, date) => {
            acc[date] = grouped[date].sort((a: TimeSlot, b: TimeSlot) =>
                new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
            );
            return acc;
        }, {} as Record<string, TimeSlot[]>);
}

async function SlotsDisplay({ type }: { type: 'delivery' | 'pickup' }) {
    const slots = await fetchTimeSlots(type);
    const groupedSlots = groupSlotsByDate(slots);

    if (Object.keys(groupedSlots).length === 0) {
        return (
            <Card className="p-6">
                <Stack spacing={2} className="text-center">
                    <Typography level="h6">Nema dostupnih termina</Typography>
                    <Typography level="body2" className="text-muted-foreground">
                        Trenutno nema dostupnih termina za {type === 'delivery' ? 'dostavu' : 'osobno preuzimanje'} u sljedećih 14 dana.
                    </Typography>
                </Stack>
            </Card>
        );
    }

    return (
        <Stack spacing={4}>
            {Object.entries(groupedSlots).map(([date, dateSlots]) => (
                <Card key={date} className="p-4">
                    <Stack spacing={3}>
                        <Typography level="h6" className="border-b pb-2">
                            {new Date(date).toLocaleDateString('hr-HR', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                            })}
                        </Typography>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {dateSlots.map((slot) => {
                                return (
                                    <div key={slot.id} className="border rounded-lg p-3 bg-background">
                                        <Stack spacing={2}>
                                            <Row spacing={2} className="items-center">
                                                <Typography level="body2" semiBold>
                                                    {new Date(slot.startAt).toLocaleTimeString('hr-HR', {
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })} - {new Date(slot.endAt).toLocaleTimeString('hr-HR', {
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </Typography>
                                                <Chip color="success" size="sm">
                                                    Dostupno
                                                </Chip>
                                            </Row>
                                            {slot.location && (
                                                <Typography level="body3" className="text-muted-foreground">
                                                    📍 {slot.location.name}
                                                </Typography>
                                            )}
                                        </Stack>
                                    </div>
                                );
                            })}
                        </div>
                    </Stack>
                </Card>
            ))}
        </Stack>
    );
}

export default async function DeliverySlotsPage() {
    return (
        <Container maxWidth="lg">
            <Stack spacing={6}>
                <PageHeader
                    padded
                    header="📅 Dostupni termini dostave"
                    subHeader="Pogledajte dostupne termine za dostavu ili osobno preuzimanje"
                />

                <Card className="p-4">
                    <Stack spacing={4}>
                        <Typography level="body1">
                            Ovdje možete vidjeti sve dostupne termine za dostavu ili osobno preuzimanje u sljedećih 14 dana.
                            Za rezervaciju termina, idite u <strong>aplikaciju za naručivanje</strong> nakon što završite s kupovinom.
                        </Typography>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <Stack spacing={2}>
                                <Typography level="body2" semiBold className="text-blue-800">
                                    💡 Kako rezervirati termin?
                                </Typography>
                                <Typography level="body3" className="text-blue-700">
                                    1. Dodajte proizvode u košaricu<br />
                                    2. Idite na checkout<br />
                                    3. Odaberite način dostave i preferirani termin<br />
                                    4. Završite narudžbu
                                </Typography>
                            </Stack>
                        </div>
                    </Stack>
                </Card>

                <Tabs defaultValue="delivery" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="delivery">
                            🚚 Dostava na adresu
                        </TabsTrigger>
                        <TabsTrigger value="pickup">
                            📦 Osobno preuzimanje
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="delivery" className="mt-6">
                        <Stack spacing={4}>
                            <Typography level="h5">Termini dostave na adresu</Typography>
                            <Typography level="body2" className="text-muted-foreground">
                                Dostava se vrši u 2-satnim blokovima na područje Zagreba i okolice.
                            </Typography>
                            <SlotsDisplay type="delivery" />
                        </Stack>
                    </TabsContent>

                    <TabsContent value="pickup" className="mt-6">
                        <Stack spacing={4}>
                            <Typography level="h5">Termini osobnog preuzimanja</Typography>
                            <Typography level="body2" className="text-muted-foreground">
                                Osobno preuzimanje na našim lokacijama u Zagrebu.
                            </Typography>
                            <SlotsDisplay type="pickup" />
                        </Stack>
                    </TabsContent>
                </Tabs>

                <Stack spacing={4}>
                    <Typography level="h6">Potrebna vam je pomoć?</Typography>
                    <WhatsAppCard />
                </Stack>

                <Row spacing={2} className="mt-8">
                    <Typography level="body1">Jesu li vam ove informacije korisne?</Typography>
                    <FeedbackModal topic="www/delivery-slots" />
                </Row>
            </Stack>
        </Container>
    );
}
