import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Container } from '@gredice/ui/Container';
import { Calendar, Warning } from '@gredice/ui/icons';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { StyledHtml } from '@gredice/ui/StyledHtml';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import { FeedbackModal } from '../../components/shared/feedback/FeedbackModal';
import { WhatsAppCard } from '../../components/social/WhatsAppCard';
import { formatPrice } from '../../lib/formatPrice';
import { KnownPages } from '../../src/KnownPages';
import { DeliveryZoneMap } from './DeliveryZoneMap';

export const metadata: Metadata = {
    title: 'Dostava',
    description: 'Sve informacije o dostavi povrća iz tvojih gredica.',
};

const distanceSurchargePerKm = 0.2;

const deliveryLocations = [
    { name: 'Velika Gorica', distance: 20 },
    { name: 'Karlovac', distance: 50 },
    { name: 'Sisak', distance: 60 },
    { name: 'Varaždin', distance: 90 },
] as const;

export default function DeliveryPage() {
    const googleMapsApiKey =
        process.env.NEXT_PUBLIC_GREDICE_GOOGLE_MAPS_API_KEY?.trim() ?? '';

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
                        className="text-foreground/85 italic"
                    >
                        Napomena: planiraj dostavu barem 48 sati unaprijed kako
                        bismo stigli pripremiti tvoje povrće i organizirati
                        dostavu na vrijeme. Termini unutar dva dana često više
                        nisu dostupni.
                    </Typography>
                    <h2 id="besplatna-dostava">🆓 Besplatna dostava</h2>
                    <p>
                        Za adrese na području Zagreba dostava je uvijek{' '}
                        <strong>besplatna</strong>, bez obzira na broj biljaka
                        ili količinu povrća u narudžbi.
                    </p>
                    <Alert startDecorator={'ℹ️'} color="info">
                        Dostava za adrese izvan Zagreba računa se prema
                        udaljenosti:
                        <strong>
                            {' '}
                            {formatPrice(distanceSurchargePerKm)} po kilometru
                        </strong>
                        .
                    </Alert>
                    <h2 id="cijena-dostave">🫰 Cijena dostave</h2>
                    <p>
                        Za dostavu izvan Zagreba cijena se računa prema
                        udaljenosti od naše najbliže{' '}
                        <a href="#osobno-preuzimanje">
                            lokacije za osobno preuzimanje
                        </a>
                        :{' '}
                        <strong>
                            {formatPrice(distanceSurchargePerKm)} po kilometru
                        </strong>
                        .
                    </p>
                    <p>Vidi mapu zona dostave i tablicu s cijenama ispod:</p>
                    <figure className="not-prose mb-4 w-full">
                        <DeliveryZoneMap apiKey={googleMapsApiKey} />
                        <figcaption className="mt-2 text-sm text-foreground">
                            <strong>Zone dostave</strong> – područje do 100 km
                            izračunato je prema udaljenosti vožnje cestom i
                            ograničeno na Hrvatsku. Podaci o cestama:{' '}
                            <a
                                href="https://www.openstreetmap.org/copyright"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline"
                            >
                                © OpenStreetMap contributors
                            </a>
                            , izračun{' '}
                            <a
                                href="https://valhalla.github.io/valhalla/api/isochrone/api-reference/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline"
                            >
                                Valhalla
                            </a>
                            . Granica Grada Zagreba prikazana je prema{' '}
                            <a
                                href="https://geohub-zagreb.hub.arcgis.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline"
                            >
                                službenim podacima GeoHuba Grada Zagreba
                            </a>
                            .
                        </figcaption>
                    </figure>
                    <table className="not-prose mb-4 w-full overflow-hidden rounded-xl border border-border border-separate border-spacing-0 bg-card text-sm text-card-foreground">
                        <caption className="caption-top pb-1 text-foreground">
                            <strong>Cijena dostave</strong> -{' '}
                            <em>
                                udaljenost će biti točno izračunata prilikom
                                naručivanja dostave
                            </em>
                        </caption>
                        <thead>
                            <tr>
                                <th className="rounded-tl-xl border-border border-r bg-accent px-2 py-2 text-left font-normal text-accent-foreground">
                                    Mjesto
                                </th>
                                <th className="border-border border-r bg-accent px-2 py-2 text-left font-normal text-accent-foreground">
                                    Cijena dostave
                                </th>
                                <th className="rounded-tr-xl bg-accent px-2 py-2 text-left font-normal text-accent-foreground">
                                    Formula
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border-border border-t border-r px-2 py-2">
                                    <strong>Zagreb</strong>
                                </td>
                                <td className="border-border border-t border-r px-2 py-2">
                                    <strong>🎉 Besplatna dostava 🎉</strong>
                                </td>
                                <td className="border-border border-t px-2 py-2">
                                    <strong>0 €</strong>
                                </td>
                            </tr>
                            {deliveryLocations.map((location) => {
                                const distanceFee =
                                    location.distance * distanceSurchargePerKm;
                                return (
                                    <tr key={location.name}>
                                        <td className="border-border border-t border-r px-2 py-2">
                                            <strong>{location.name}</strong> (
                                            {location.distance} km)
                                        </td>
                                        <td className="border-border border-t border-r px-2 py-2">
                                            <strong>
                                                {formatPrice(distanceFee)}
                                            </strong>
                                        </td>
                                        <td className="border-border border-t px-2 py-2">
                                            <strong>
                                                {location.distance} km ×{' '}
                                                {formatPrice(
                                                    distanceSurchargePerKm,
                                                )}
                                                /km = {formatPrice(distanceFee)}
                                            </strong>
                                        </td>
                                    </tr>
                                );
                            })}
                            <tr>
                                <td className="border-border border-t border-r px-2 py-2">
                                    <strong>Ostala mjesta</strong>
                                    <br />(
                                    <em>
                                        unutar 100km od lokacije za osobno
                                        preuzimanje
                                    </em>
                                    )
                                </td>
                                <td className="border-border border-t border-r px-2 py-2">
                                    <strong>
                                        {formatPrice(distanceSurchargePerKm)}
                                        /km
                                    </strong>
                                </td>
                                <td className="border-border border-t px-2 py-2">
                                    <strong>
                                        udaljenost ×{' '}
                                        {formatPrice(distanceSurchargePerKm)}
                                        /km
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
                        <Stack spacing={6}>
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
            <Stack spacing={4}>
                <Typography level="h5">Imaš dodatna pitanja?</Typography>
                <WhatsAppCard />
            </Stack>
            <Row spacing={4} className="mt-8">
                <Typography level="body1">
                    Jesu li ti informacije korisne?
                </Typography>
                <FeedbackModal topic="www/faq" />
            </Row>
        </Container>
    );
}
