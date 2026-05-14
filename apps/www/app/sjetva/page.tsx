import { StyledHtml } from '@gredice/ui/StyledHtml';
import { Container } from '@signalco/ui-primitives/Container';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { Metadata } from 'next';
import { FeedbackModal } from '../../components/shared/feedback/FeedbackModal';
import { PageHeader } from '../../components/shared/PageHeader';
import { getOperationsData } from '../../lib/plants/getOperationsData';
import { KnownPages } from '../../src/KnownPages';

export const metadata: Metadata = {
    title: 'Sjetva biljaka',
    description:
        'Saznaj kako funkcionira sjetva biljaka u Gredicama, koliko košta i koje pogodnosti dobivaš tijekom ljeta.',
};

const DEFAULT_FREE_WATERING_OPERATION_LABEL = 'Površinsko zalijevanje (20 L)';
const FREE_WATERING_OPERATION_ID = 274;

export default async function SowingPage() {
    const operationsData = await getOperationsData();
    const freeWateringOperationLabel =
        operationsData.find(
            (operation) => operation.id === FREE_WATERING_OPERATION_ID,
        )?.information.label ?? DEFAULT_FREE_WATERING_OPERATION_LABEL;

    return (
        <Container maxWidth="md">
            <Stack spacing={4}>
                <PageHeader
                    header="Sjetva biljaka"
                    subHeader="Sve o naručivanju sjetve, cijeni i dodatnim pogodnostima tijekom ljeta."
                    padded
                />
                <StyledHtml>
                    <p>
                        Sjetva je prvi korak prema novoj berbi u tvojoj gredici.
                        Putem{' '}
                        <a href={KnownPages.GardenApp}>aplikacije Gredice</a>{' '}
                        možeš naručiti sjetvu biljka u tvojoj gredici i
                        prepustiti našem timu da pripremi zemlju, posije
                        odabrane biljke i prati njihov rast.
                    </p>
                    <h2>🫰 Cijena sjetve</h2>
                    <p>
                        Sjetva se naplaćuje po biljci i trenutno iznosi
                        minimalno 1,99&nbsp;€ ili 1.990 🌻. Cijena uključuje
                        nabavu sjemena, pripremu tla i evidenciju radnje u
                        aplikaciji, tako da u svakom trenutku znaš što je
                        posađeno u tvojoj gredici.
                    </p>
                    <p>
                        Točna cijena sjetve može varirati ovisno o vrsti biljke
                        i dostupnosti sjemena. Točne informacije o cijeni svake
                        biljke možeš pronaći na stranici{' '}
                        <a href={KnownPages.Plants}>biljaka</a>.
                    </p>
                    <h2>✍️ Zakazivanje</h2>
                    <p>
                        Kao i ostale radnje u Gredicama, sjetvu možeš zakazati
                        unaprijed. Odaberi datum koji ti odgovara, a naš će tim
                        pripremiti gredicu točno kada želiš. Sve potvrđene i
                        nadolazeće radnje pregledavaš na istom mjestu u
                        aplikaciji.
                    </p>
                    <h2>🗓️ Kalendar sjetve</h2>
                    <p>
                        Svaka biljka ima svoj kalendar sjetve. Za odabir
                        idealnog termina posjeti stranicu{' '}
                        <a href={KnownPages.Plants}>biljaka</a>, gdje možeš
                        pročitati detaljne informacije o vremenu sjetve,
                        razmacima i potrebnoj njezi za svaku biljku.
                    </p>
                    <p>
                        Imaj na umu da je kalendar sjetve orijentacijski i da se
                        može prilagoditi ovisno o vremenskim uvjetima i
                        dostupnosti te tvojim željama i radoznalosti. Nema
                        nikakvih ograničenja u broju sjetvi, kombinacijama i
                        vremenu sjetve, pa slobodno eksperimentiraj i istražuj
                        nove biljke!
                    </p>
                    <h2>🌱 Proljetne pogodnosti</h2>
                    <p>
                        Tijekom proljeća svaka naručena sjetva donosi besplatno
                        3 zalijevanja* &quot;
                        <strong>{freeWateringOperationLabel}</strong>
                        &quot; za podignutu gredicu, pri čemu se zalijevanje
                        obavlja svaki drugi dan.
                    </p>
                    <small>
                        *{' '}
                        <i>
                            Ako posiješ novu biljku dok je prethodni besplatni
                            period još aktivan, zalijevanje se produžuje. Na
                            primjer, ako tijekom 6 uzastopnih dana siješ po
                            jednu biljku, imat ćeš ukupno 12 besplatnih
                            zalijevanja.
                        </i>
                    </small>
                    <h2>☀️ Ljetne pogodnosti</h2>
                    <p>
                        Tijekom ljeta svaka naručena sjetva donosi besplatno 5
                        zalijevanja* &quot;
                        <strong>{freeWateringOperationLabel}</strong>
                        &quot; za podignutu gredicu.
                    </p>
                    <small>
                        *{' '}
                        <i>
                            Ako posiješ novu biljku dok je prethodni besplatni
                            period još aktivan, zalijevanje se produžuje. Na
                            primjer, ako tijekom 5 uzastopnih dana siješ po
                            jednu biljku, imat ćeš ukupno 10 dana besplatnog
                            zalijevanja.
                        </i>
                    </small>
                    <h2>🍂 Jesenske pogodnosti</h2>
                    <p>
                        Tijekom jeseni svaka naručena sjetva donosi besplatno 3
                        zalijevanja* &quot;
                        <strong>{freeWateringOperationLabel}</strong>
                        &quot; za podignutu gredicu, pri čemu se zalijevanje
                        obavlja svaki drugi dan.
                    </p>
                    <small>
                        *{' '}
                        <i>
                            Ako posiješ novu biljku dok je prethodni besplatni
                            period još aktivan, zalijevanje se produžuje. Na
                            primjer, ako tijekom 6 uzastopnih dana siješ po
                            jednu biljku, imat ćeš ukupno 12 besplatnih
                            zalijevanja.
                        </i>
                    </small>
                    <h2>💭 Sljedeći koraci</h2>
                    <p>
                        Kada biljke niknu, možeš nastaviti planirati ostale
                        radnje poput prihrane ili berbe izravno u aplikaciji. Za
                        pregled svih dostupnih aktivnosti posjeti stranicu{' '}
                        <a href={KnownPages.Operations}>radnji</a>.
                    </p>
                </StyledHtml>
                <Row spacing={2} className="mt-4">
                    <Typography level="body1">
                        Jesu li ti informacije o sjetvi bile korisne?
                    </Typography>
                    <FeedbackModal topic="www/sowing" />
                </Row>
            </Stack>
        </Container>
    );
}
