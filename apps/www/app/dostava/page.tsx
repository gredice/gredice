import { StyledHtml } from '@gredice/ui/StyledHtml';
import { Alert } from '@signalco/ui/Alert';
import { Calendar, Warning } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Container } from '@signalco/ui-primitives/Container';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { Metadata } from 'next';
import { FeedbackModal } from '../../components/shared/feedback/FeedbackModal';
import { PageHeader } from '../../components/shared/PageHeader';
import { WhatsAppCard } from '../../components/social/WhatsAppCard';
import { formatPrice } from '../../lib/formatPrice';
import { KnownPages } from '../../src/KnownPages';

export const metadata: Metadata = {
    title: 'Dostava',
    description: 'Sve informacije o dostavi povrća iz tvojih gredica.',
};

const baseDeliveryPrice = 4.99;
const distanceSurchargePerKm = 0.2;

const deliveryLocations = [
    { name: 'Velika Gorica', distance: 20 },
    { name: 'Karlovac', distance: 50 },
    { name: 'Sisak', distance: 60 },
    { name: 'Varaždin', distance: 90 },
] as const;

export default function DeliveryPage() {
    return (
        <Container maxWidth="md">
            <Stack>
                <PageHeader
                    padded
                    header="🚚 Dostava"
                    subHeader="Sve informacije o dostavi povrća iz tvojih gredica"
                />
                <StyledHtml>
                    <p>
                        Kad tvoje povrće bude spremno za berbu, mi ćemo se
                        pobrinuti da ga sigurno i svježe dostavimo na tvoju
                        adresu - ili te čekamo da ga preuzmeš osobno. U nastavku
                        možeš saznati kako funkcionira dostava, koje su opcije
                        dostupne i koji su uvjeti.
                    </p>
                    <Typography
                        level="body2"
                        className="text-muted-foreground italic"
                    >
                        Napomena: planiraj dostavu barem 48 sati unaprijed kako
                        bismo stigli pripremiti tvoje povrće i organizirati
                        dostavu na vrijeme. Termini unutar dva dana često više
                        nisu dostupni.
                    </Typography>
                    <h2 id="besplatna-dostava">🆓 Besplatna dostava</h2>
                    <p>
                        Ukoliko tvoja dostava sadrži povrće od biljke za koju se
                        radi prva dostava, ostvaruješ pravo na{' '}
                        <strong>besplatnu dostavu</strong> za područje Zagreba,
                        bez obzira na količinu povrća koju želiš primiti u toj
                        dostavi.
                    </p>
                    <Alert startDecorator={'ℹ️'} color="info">
                        Za više besplatnih dostava, u berbu uključi barem jednu
                        biljku koja se prvi put dostavlja.
                        <br />
                        Na taj način možeš ostvariti pravo na{' '}
                        <strong>18 besplatnih</strong> dostava za gredicu sa 18
                        posađenih biljaka.
                    </Alert>
                    <p>
                        <small>
                            <em>
                                Pravo na besplatnu dostavu možeš iskoristiti
                                najviše jednom tjedno. Ako želiš dodatne dostave
                                u istom tjednu možeš ih naručiti po standardnoj
                                cijeni.
                            </em>
                        </small>
                    </p>
                    <h2 id="cijena-dostave">🫰 Cijena dostave</h2>
                    <p>
                        Standardna cijena za dostavu je{' '}
                        <strong>{formatPrice(baseDeliveryPrice)}</strong> po
                        dostavi - neovisno o količini povrća.
                    </p>
                    <p>
                        Za dostavu izvan Zagreba, cijeni dostave dodaje se
                        dodatak za udaljenost -{' '}
                        <strong>
                            {formatPrice(distanceSurchargePerKm)} po kilometru
                        </strong>{' '}
                        od naše najbliže{' '}
                        <a href="#osobno-preuzimanje">
                            lokacije za osobno preuzimanje
                        </a>
                        .
                    </p>
                    <p>Vidi mapu zona dostave i tablicu s cijenama ispod:</p>
                    <div>
                        <figure className="w-full aspect-[4/3] mb-4 text-center">
                            <iframe
                                title="Zone dostave"
                                src="https://www.google.com/maps/d/u/4/embed?mid=1hya16VbRWVVdH4G-8-iCHHrLl8pAISA&ehbc=2E312F&ll=45.778793753891875%2C15.983640700842331&z=9"
                                className="w-full h-full border-0 rounded-lg"
                                sandbox="allow-scripts allow-same-origin"
                                loading="lazy"
                            ></iframe>
                            <figcaption>
                                <strong>Zone dostave</strong> -{' '}
                                <em>
                                    zone su okvirne, a stvarne zone dostave mogu
                                    se razlikovati.
                                </em>
                            </figcaption>
                        </figure>
                    </div>
                    <table
                        style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            borderStyle: 'hidden',
                            boxShadow: '0 0 0 1px #ddd',
                            borderRadius: '12px',
                            marginBottom: '1rem',
                        }}
                    >
                        <caption>
                            <strong>Cijena dostave</strong> -{' '}
                            <em>
                                udaljenost će biti točno izračunata prilikom
                                naručivanja dostave
                            </em>
                        </caption>
                        <thead>
                            <tr>
                                <th
                                    style={{
                                        border: '1px solid #ddd',
                                        padding: '8px',
                                        backgroundColor: '#faf4e3',
                                        borderTopLeftRadius: '12px',
                                    }}
                                >
                                    Mjesto
                                </th>
                                <th
                                    style={{
                                        border: '1px solid #ddd',
                                        padding: '8px',
                                        backgroundColor: '#faf4e3',
                                    }}
                                >
                                    Prva dostava biljke
                                </th>
                                <th
                                    style={{
                                        border: '1px solid #ddd',
                                        padding: '8px',
                                        backgroundColor: '#faf4e3',
                                        borderTopRightRadius: '12px',
                                    }}
                                >
                                    Ostale dostave
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td
                                    style={{
                                        border: '1px solid #ddd',
                                        padding: '8px',
                                    }}
                                >
                                    <strong>Zagreb</strong>
                                </td>
                                <td
                                    style={{
                                        border: '1px solid #ddd',
                                        padding: '8px',
                                    }}
                                >
                                    <strong>🎉 Besplatna dostava 🎉</strong>
                                </td>
                                <td
                                    style={{
                                        border: '1px solid #ddd',
                                        padding: '8px',
                                    }}
                                >
                                    <strong>
                                        {formatPrice(baseDeliveryPrice)}
                                    </strong>
                                </td>
                            </tr>
                            {deliveryLocations.map((location) => {
                                const distanceFee =
                                    location.distance * distanceSurchargePerKm;
                                const totalFee =
                                    baseDeliveryPrice + distanceFee;
                                return (
                                    <tr key={location.name}>
                                        <td
                                            style={{
                                                border: '1px solid #ddd',
                                                padding: '8px',
                                            }}
                                        >
                                            <strong>{location.name}</strong> (
                                            {location.distance} km)
                                        </td>
                                        <td
                                            style={{
                                                border: '1px solid #ddd',
                                                padding: '8px',
                                            }}
                                        >
                                            <strong>
                                                {formatPrice(distanceFee)}
                                            </strong>
                                        </td>
                                        <td
                                            style={{
                                                border: '1px solid #ddd',
                                                padding: '8px',
                                            }}
                                        >
                                            <strong>
                                                {formatPrice(totalFee)}
                                            </strong>
                                        </td>
                                    </tr>
                                );
                            })}
                            <tr>
                                <td
                                    style={{
                                        border: '1px solid #ddd',
                                        padding: '8px',
                                    }}
                                >
                                    <strong>Ostala mjesta</strong>
                                    <br />(
                                    <em>
                                        unutar 100km od lokacije za osobno
                                        preuzimanje
                                    </em>
                                    )
                                </td>
                                <td
                                    style={{
                                        border: '1px solid #ddd',
                                        padding: '8px',
                                    }}
                                >
                                    <strong>
                                        {formatPrice(distanceSurchargePerKm)}/km
                                    </strong>
                                </td>
                                <td
                                    style={{
                                        border: '1px solid #ddd',
                                        padding: '8px',
                                    }}
                                >
                                    <strong>
                                        {formatPrice(baseDeliveryPrice)}
                                    </strong>{' '}
                                    +{' '}
                                    <strong>
                                        {formatPrice(distanceSurchargePerKm)}/km
                                    </strong>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <Alert startDecorator={<Warning />} color="warning">
                        Dostava nije moguća na udaljenost veću od{' '}
                        <strong>
                            100 km od naše{' '}
                            <a href="#osobno-preuzimanje">
                                lokacije za osobno preuzimanje
                            </a>
                        </strong>
                        , niti nudimo dostavu <strong>izvan Hrvatske</strong>.
                    </Alert>
                    <h2 id="osobno-preuzimanje">🚶 Osobno preuzimanje</h2>
                    <p>
                        Ako ti više odgovara osobno preuzeti svoje povrće,
                        uvijek možeš doći do jedne od naših{' '}
                        <strong>lokacija u Zagrebu</strong>. Ova opcija je
                        potpuno <strong>besplatna</strong>, a točne adrese i
                        slobodne termine možeš pronaći u aplikaciji. Samo
                        prilikom narudžbe odaberi opciju &quot;Osobno
                        preuzimanje&quot; i odaberi lokaciju i termin koji ti
                        najviše odgovara.
                    </p>
                    <p>Lokacije za osobno preuzimanje:</p>
                    <ul>
                        <li>
                            <strong>Gredice HQ</strong> -{' '}
                            <a
                                href={KnownPages.GoogleMapsGrediceHQ}
                                target="_blank"
                                rel="noopener"
                            >
                                Ulica Julija Knifera 3, Zagreb
                            </a>
                        </li>
                    </ul>
                    <h2 id="planiranje-i-zakazivanje">
                        ⌛ Planiranje i zakazivanje
                    </h2>
                    <p>
                        Dostave se zakazuju unaprijed, minimalno{' '}
                        <strong>48 sati</strong> prije željenog termina. Nakon
                        što zatražiš dostavu, obavijestit ćemo te ako je ona
                        potvrđena ili eventualno odbijena, ovisno o trenutačnoj
                        popunjenosti rasporeda.
                    </p>
                    <p>
                        Dostave se odvijaju u{' '}
                        <strong>2-satnim vremenskim blokovima</strong>, a sve
                        dostupne termine možeš vidjeti u aplikaciji ili na našoj
                        stranici s terminima. Ako te ne pronađemo na adresi u
                        dogovoreno vrijeme, pokušat ćemo te kontaktirati. U
                        slučaju da dostava ipak ne uspije, svoje povrće možeš
                        naknadno osobno preuzeti na našoj lokaciji u Zagrebu.
                        Ako povrće ne preuzmeš u roku od{' '}
                        <strong>72 sata</strong>, donirat ćemo ga onima kojima
                        je najpotrebnije.
                    </p>
                    <hr />
                    <p>
                        Tvoje povrće čeka da stigne do tebe - svježe, lokalno i
                        s ljubavlju uzgojeno. 🥬📦
                    </p>
                    <hr />
                </StyledHtml>
            </Stack>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle>📅 Termini dostave</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Stack spacing={3}>
                            <Typography>
                                Želiš vidjeti koji su termini dostupni za
                                dostavu tvojeg povrća?
                            </Typography>
                            <Button
                                href={KnownPages.DeliverySlots}
                                variant="solid"
                                startDecorator={<Calendar className="size-4" />}
                            >
                                Pogledaj dostupne termine
                            </Button>
                        </Stack>
                    </CardContent>
                </Card>
            </div>
            <Stack spacing={2}>
                <Typography level="h5">Imaš dodatna pitanja?</Typography>
                <WhatsAppCard />
            </Stack>
            <Row spacing={2} className="mt-8">
                <Typography level="body1">
                    Jesu li ti informacije korisne?
                </Typography>
                <FeedbackModal topic="www/faq" />
            </Row>
        </Container>
    );
}
