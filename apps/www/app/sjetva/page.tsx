import { Container } from '@signalco/ui-primitives/Container';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { Metadata } from 'next';
import { FeedbackModal } from '../../components/shared/feedback/FeedbackModal';
import { PageHeader } from '../../components/shared/PageHeader';
import { StyledHtml } from '../../components/shared/StyledHtml';
import { KnownPages } from '../../src/KnownPages';

export const metadata: Metadata = {
    title: 'Sjetva biljaka',
    description:
        'Saznaj kako funkcionira sjetva biljaka u Gredicama, koliko košta i koje pogodnosti dobivaš tijekom ljeta.',
};

export default function SowingPage() {
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
                        možeš naručiti sjetvu za svako polje i prepustiti našem
                        timu da pripremi zemlju, posije odabrane biljke i prati
                        njihov rast.
                    </p>
                    <h2>Cijena sjetve</h2>
                    <p>
                        Sjetva se naplaćuje po biljci i trenutno iznosi
                        1,99&nbsp;€ ili 1.990 suncokreta. Cijena uključuje
                        nabavu sjemena, pripremu tla i evidenciju radnje u
                        aplikaciji, tako da u svakom trenutku znaš što je
                        posađeno u tvojoj gredici.
                    </p>
                    <h2>Zakazivanje kao i drugih radnji</h2>
                    <p>
                        Kao i ostale radnje u Gredicama, sjetvu možeš zakazati
                        unaprijed. Odaberi datum koji ti odgovara, a naš će tim
                        pripremiti gredicu točno kada želiš. Sve potvrđene i
                        nadolazeće radnje pregledavaš na istom mjestu u
                        aplikaciji.
                    </p>
                    <h2>Provjera kalendara sjetve</h2>
                    <p>
                        Svaka biljka ima svoj preporučeni kalendar. Za odabir
                        idealnog termina posjeti stranicu{' '}
                        <a href={KnownPages.Plants}>biljaka</a>, gdje možeš
                        pročitati detaljne informacije o vremenu sjetve,
                        razmacima i potrebnoj njezi.
                    </p>
                    <h2>Ljetna pogodnost zalijevanja</h2>
                    <p>
                        Tijekom ljeta svaka naručena sjetva donosi besplatno pet
                        dana usluge &quot;Površinsko zalijevanje
                        (10&nbsp;L)&quot; za podignute gredice u koje je sijano.
                        Ako posiješ novu biljku dok je prethodni besplatni
                        period još aktivan, zalijevanje se samo produžuje. Na
                        primjer, ako tijekom pet uzastopnih dana siješ po jednu
                        biljku, dobit ćeš ukupno deset dana besplatnog
                        zalijevanja, a ne dvadeset i pet dana.
                    </p>
                    <h2>Sljedeći koraci</h2>
                    <p>
                        Kada biljke niknu, možeš nastaviti planirati ostale
                        radnje poput prihrane ili berbe izravno u{' '}
                        <a href={KnownPages.GardenApp}>aplikaciji</a>. Za
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
