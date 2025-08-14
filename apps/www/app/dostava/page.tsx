import { Stack } from "@signalco/ui-primitives/Stack"
import { StyledHtml } from "../../components/shared/StyledHtml"
import { PageHeader } from "../../components/shared/PageHeader"
import { Container } from "@signalco/ui-primitives/Container"
import { Row } from "@signalco/ui-primitives/Row"
import { FeedbackModal } from "../../components/shared/feedback/FeedbackModal"
import { Typography } from "@signalco/ui-primitives/Typography"
import { WhatsAppCard } from "../../components/social/WhatsAppCard"
import { Button } from "@signalco/ui-primitives/Button"
import { Calendar } from "@signalco/ui-icons"
import { KnownPages } from "../../src/KnownPages"
import { Card, CardContent, CardHeader, CardTitle } from "@signalco/ui-primitives/Card"

export default function DeliveryPage() {
    return (
        <Container maxWidth="md">
            <Stack>
                <PageHeader
                    padded
                    header="🚚 Dostava"
                    subHeader="Sve informacije o dostavi povrća iz tvojih gredica" />
                <StyledHtml>
                    <p>Kad tvoje povrće bude spremno za berbu, mi ćemo se pobrinuti da ga sigurno i svježe dostavimo na tvoju adresu - ili te čekamo da ga preuzmeš osobno. U nastavku možeš saznati kako funkcionira dostava, koje su opcije dostupne i koji su uvjeti.</p>
                    <h2 id="kako-funkcionira-dostava-">Kako funkcionira dostava?</h2>
                    <p>
                        Za svako polje u gredici sa tvojim biljkama, ostvaruješ pravo na <strong>jednu besplatnu dostavu</strong> na
                        području Zagreba, bez obzira na količinu povrća koju želiš primiti u toj dostavi. Pravo na
                        besplatnu dostavu, možeš iskoristiti <strong>najviše jednu tjedno</strong>.
                        Ako želiš dodatne dostave u istom tjednu možeš ih naručiti po standardnoj cijeni.
                    </p>
                    <p>Standardna cijena za dostavu je <strong>4.99 €</strong> po dostavi.</p>
                    <p>
                        Za dostavu izvan Zagreba, cijeni dostave dodaje se dodatak za udaljenost
                        - <strong>0,10 € po kilometru</strong> od naše najbliže <a href="#osobno-preuzimanje">lokacije za osobno preuzimanje</a>.
                    </p>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                        <caption>
                            <strong>Cijena dostave</strong> - <em>udaljenost će biti točno izračunata prilikom naručivanja dostave</em>
                        </caption>
                        <thead>
                            <tr>
                                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Mjesto</th>
                                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Prva dostava</th>
                                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Ostale dostave</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>Zagreb</strong></td>
                                <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>🎉 Besplatna dostava 🎉</strong></td>
                                <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>4,99 €</strong></td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>Velika Gorica</strong> (20 km)</td>
                                <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>2,00 €</strong></td>
                                <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>6,99 €</strong></td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>Karlovac</strong> (50 km)</td>
                                <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>5,00 €</strong></td>
                                <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>9,99 €</strong></td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>Sisak</strong> (60 km)</td>
                                <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>6,00 €</strong></td>
                                <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>10,99 €</strong></td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>Varaždin</strong> (90 km)</td>
                                <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>9,00 €</strong></td>
                                <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>13,99 €</strong></td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>Ostala mjesta</strong><br />(<em>unutar 200km od lokacije za osobno preuzimanje</em>)</td>
                                <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>0,10 €/km</strong></td>
                                <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>4,99 €</strong> + <strong>0,10 €/km</strong></td>
                            </tr>
                        </tbody>
                    </table>
                    <p>
                        Dostava nije moguća na udaljenost veću od <strong>200 km od naše <a href="#osobno-preuzimanje">lokacije za osobno preuzimanje</a></strong>,
                        niti nudimo dostavu <strong>izvan Hrvatske</strong>.
                    </p>
                    <h2 id="osobno-preuzimanje">Osobno preuzimanje</h2>
                    <p>
                        Ako ti više odgovara osobno preuzeti svoje povrće, uvijek možeš doći do jedne
                        od naših <strong>lokacija u Zagrebu</strong>. Ova opcija je
                        potpuno <strong>besplatna</strong>, a točne adrese i slobodne termine možeš
                        pronaći u aplikaciji. Samo prilikom narudžbe odaberi opciju &quot;Osobno preuzimanje&quot; i
                        odaberi lokaciju i termin koji ti najviše odgovara.
                    </p>
                    <p>Lokacije za osobno preuzimanje:</p>
                    <ul>
                        <li><strong>Gredice HQ</strong> - <a href="https://g.co/kgs/8J9Mf9r">Ulica Julija Knifera 3, Zagreb</a></li>
                    </ul>
                    <h2 id="planiranje-i-zakazivanje">Planiranje i zakazivanje</h2>
                    <p>Dostave se zakazuju unaprijed, minimalno <strong>48 sati</strong> prije željenog termina. Nakon što zatražiš dostavu, obavijestit ćemo te ako je ona potvrđena ili eventualno odbijena, ovisno o trenutačnoj popunjenosti rasporeda.</p>
                    <p>
                        Dostave se odvijaju u <strong>2-satnim vremenskim blokovima</strong>, a sve dostupne termine možeš
                        vidjeti u aplikaciji ili na našoj stranici s terminima. Ako te ne pronađemo na adresi u dogovoreno vrijeme, pokušat ćemo te
                        kontaktirati. U slučaju da dostava ipak ne uspije, svoje povrće možeš naknadno osobno preuzeti na našoj
                        lokaciji u Zagrebu. Ako povrće ne preuzmeš u roku od <strong>72 sata</strong>, donirat ćemo ga onima
                        kojima je najpotrebnije.
                    </p>
                    <hr />
                    <p>Tvoje povrće čeka da stigne do tebe - svježe, lokalno i s ljubavlju uzgojeno. 🥬📦</p>
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
                            <Typography>Želiš vidjeti koji su termini dostupni za dostavu tvojeg povrća?</Typography>
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
                <Typography level="body1">Jesu li ti informacije korisne?</Typography>
                <FeedbackModal topic="www/faq" />
            </Row>
        </Container>
    )
}