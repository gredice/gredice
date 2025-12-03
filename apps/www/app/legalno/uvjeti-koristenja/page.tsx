import { StyledHtml } from '@gredice/ui/StyledHtml';
import { Container } from '@signalco/ui-primitives/Container';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { Metadata } from 'next';
import { PageHeader } from '../../../components/shared/PageHeader';

export const metadata: Metadata = {
    title: 'Uvjeti korištenja',
    description: 'Uvjeti korištenja web stranice Gredice.',
};

export default function UvjetiKoristenjaPage() {
    return (
        <Container maxWidth="sm">
            <Stack>
                <PageHeader
                    padded
                    header="Uvjeti Korištenja"
                    subHeader="Ovi uvjeti korištenja reguliraju pristup i korištenje web stranice."
                />
                <StyledHtml>
                    <h2>Uvod</h2>
                    <p>
                        Ovi uvjeti korištenja (&quot;<strong>Uvjeti</strong>
                        &quot;) reguliraju pristup i korištenje web stranice (
                        <a href="https://www.gredice.com">www.gredice.com</a>,
                        uključujući sve podstranice) (&quot;
                        <strong>Platforma</strong>&quot;) koju posluje Gredice
                        društvo s ograničenom odgovornošću za proizvodnju,
                        trgovinu i usluge, sa sjedištem na Ulica Julija Knifera
                        3, Zagreb, Hrvatska, OIB: 86171547809. Korištenje
                        Platforme podrazumijeva suglasnost s ovim Uvjetima.
                        Ukoliko se ne slažete s Uvjetima, molimo vas da ne
                        koristite Platformu.
                    </p>
                    <h2>Definicije</h2>
                    <p>
                        U smislu ovih Uvjeta, izrazi koji su označeni velikim
                        slovom imaju sljedeća značenja:
                    </p>
                    <ul>
                        <li>
                            &quot;<strong>Korisnik</strong>&quot; označava svaku
                            fizičku ili pravnu osobu koja koristi Platformu.
                        </li>
                        <li>
                            &quot;<strong>Sadržaj</strong>&quot; odnosi se na
                            sve informacije, tekst, slike, videozapise i druge
                            materijale koji se nalaze na Platformi.
                        </li>
                        <li>
                            &quot;<strong>Usluge</strong>&quot; obuhvaćaju sve
                            usluge dostupne putem Platforme, uključujući, ali ne
                            ograničavajući se na, pretraživanje, interakcije s
                            drugim korisnicima i dijeljenje sadržaja.
                        </li>
                    </ul>
                    <h2>Prava i obveze Korisnika</h2>
                    <p>Korisnik se obvezuje:</p>
                    <ul>
                        <li>
                            Korištenje Platforme isključivo u svrhe koje su u
                            skladu s važećim zakonima i propisima.
                        </li>
                        <li>
                            Ne objavljivati, dijeliti ili na bilo koji način
                            distribuirati Sadržaj koji je nezakonit, uvredljiv,
                            obmanjujući ili koji krši prava trećih osoba.
                        </li>
                        <li>
                            Održavati sigurnost svog korisničkog računa i
                            pravovremeno obavještavati Platformu o bilo kakvim
                            neovlaštenim pristupima.
                        </li>
                    </ul>
                    <h2>Ovlaštenja i odgovornosti Platforme</h2>
                    <p>Platforma zadržava pravo:</p>
                    <ul>
                        <li>
                            Odbiti ili ukloniti bilo koji Sadržaj koji se smatra
                            neprikladnim ili nesukladnim ovim Uvjetima.
                        </li>
                        <li>
                            Pružiti Korisnicima podršku u vezi s korištenjem
                            Usluga, ali ne jamči neprekidnu ili potpuno sigurnu
                            uslugu.
                        </li>
                        <li>
                            Izmijeniti, suspendirati ili prekinuti dostupnost
                            Platforme bez prethodne obavijesti.
                        </li>
                    </ul>
                    <h2>Intelektualno vlasništvo</h2>
                    <p>
                        Svi elementi Platforme, uključujući, ali ne
                        ograničavajući se na, dizajn, logotipe, softver i
                        Sadržaj, zaštićeni su zakonima o autorskim pravima i
                        drugim pravima intelektualnog vlasništva osim ako nije
                        drugačije navedeno. Korisnici se obvezuju ne koristiti
                        te elemente bez izričitog pisanog odobrenja Platforme.
                    </p>
                    <h2>Odgovornost</h2>
                    <p>
                        Platforma ne snosi odgovornost za bilo kakvu štetu koja
                        može nastati uslijed korištenja ili nemogućnosti
                        korištenja Platforme, uključujući, ali ne ograničavajući
                        se na, izravne, neizravne, slučajne i posljedične štete.
                    </p>
                    <h2>Mjerodavno pravo i rješavanje sporova</h2>
                    <p>
                        Ovi Uvjeti podliježu zakonodavstvu Republike Hrvatske.
                        Svi sporovi koji proizađu iz ovih Uvjeta rješavat će se
                        pred nadležnim sudovima u Zagrebu.
                    </p>
                    <h2>Završne odredbe</h2>
                    <p>
                        Ovi Uvjeti predstavljaju cjelokupni sporazum između
                        Korisnika i Platforme u vezi s korištenjem Platforme.
                        Platforma zadržava pravo izmjene ovih Uvjeta, a
                        Korisnici će biti obaviješteni o svim promjenama.
                    </p>
                    <p>
                        Za sve dodatne informacije ili upite, molimo
                        kontaktirajte nas putem e-pošte na{' '}
                        <a href="mailto:kontakt@gredice.com">
                            kontakt@gredice.com
                        </a>
                        .
                    </p>
                </StyledHtml>
                <Typography level="body2" secondary className="mt-8">
                    Zadnja izmjena: 28. Veljača 2025.
                </Typography>
            </Stack>
        </Container>
    );
}
