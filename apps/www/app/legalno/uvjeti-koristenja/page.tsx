import { Container } from '@gredice/ui/Container';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import { StyledHtml } from '@gredice/ui/StyledHtml';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Uvjeti korištenja',
    description:
        'Uvjeti korištenja web stranice Gredice, uključujući pravila za suncokrete i Gredice saldo.',
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
                        Platforme podrazumijeva suglasnost s ovim Uvjetima. Ako
                        se ne slažeš s Uvjetima, molimo te da ne koristiš
                        Platformu.
                    </p>
                    <h2>Definicije</h2>
                    <p>
                        U smislu ovih Uvjeta, izrazi koji su označeni velikim
                        slovom imaju sljedeća značenja:
                    </p>
                    <ul>
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
                        <li>
                            &quot;<strong>Suncokreti</strong>&quot; označavaju
                            Gredice bodove odnosno prepaid saldo koji se koristi
                            samo unutar Gredica za vrtne akcije i povezane
                            usluge.
                        </li>
                    </ul>
                    <h2>Suncokreti i prepaid saldo</h2>
                    <p>
                        Suncokreti se evidentiraju na korisničkom računu kao
                        Gredice saldo. Nisu opće sredstvo plaćanja, ne prenose
                        se na druge korisnike i ne mogu se zamijeniti za
                        gotovinu osim u slučajevima u kojima je povrat zakonski
                        obvezan ili ga Gredice izričito odobre.
                    </p>
                    <p>
                        Kod naručivanja vrtne akcije saldo se može najprije
                        rezervirati. Ako se akcija otkaže prije obrade,
                        rezervacija se otpušta i vraća na raspoloživi saldo.
                        Nakon izvršene akcije rezervirani iznos se naplaćuje iz
                        salda, a povezani dokumenti dostupni su u korisničkom
                        profilu kada su izdani.
                    </p>
                    <p>
                        Bonus suncokreti iz paketa služe za korištenje unutar
                        Gredica i ne predstavljaju zaseban novčani iznos.
                        Povrati i korekcije rješavaju se prema pravilima na
                        stranici{' '}
                        <a href="/povrati-i-povrat-novca">Povrat novca</a>.
                    </p>
                    <h2>Prava i obveze pri korištenju Platforme</h2>
                    <p>Korištenjem Platforme potrebno je:</p>
                    <ul>
                        <li>
                            Koristiti Platformu isključivo u svrhe koje su u
                            skladu s važećim zakonima i propisima.
                        </li>
                        <li>
                            Ne objavljivati, dijeliti ili na bilo koji način
                            distribuirati Sadržaj koji je nezakonit, uvredljiv,
                            obmanjujući ili koji krši prava trećih osoba.
                        </li>
                        <li>
                            Održavati sigurnost korisničkog računa i
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
                            Pružiti podršku u vezi s korištenjem Usluga, ali ne
                            jamči neprekidnu ili potpuno sigurnu uslugu.
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
                        drugačije navedeno. Nije dopušteno koristiti te elemente
                        bez izričitog pisanog odobrenja Platforme.
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
                        Ovi Uvjeti predstavljaju cjelokupni sporazum o
                        korištenju Platforme. Platforma zadržava pravo izmjene
                        ovih Uvjeta, a obavijest o promjenama bit će dostupna
                        putem Platforme.
                    </p>
                    <p>
                        Za sve dodatne informacije ili upite, slobodno nas
                        kontaktiraj putem e-pošte na{' '}
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
