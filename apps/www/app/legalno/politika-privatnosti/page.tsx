import { Container } from '@gredice/ui/Container';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import { StyledHtml } from '@gredice/ui/StyledHtml';
import { Typography } from '@gredice/ui/Typography';
import { createPublicMetadata } from '../../../lib/seo/publicMetadata';
import { KnownPages } from '../../../src/KnownPages';

export const metadata = createPublicMetadata({
    title: 'Politika privatnosti',
    description:
        'Kako Gredice obrađuju podatke o računu, vrtu, narudžbama i korištenju usluga te kako ostvariti svoja prava.',
    path: KnownPages.LegalPrivacy,
    eyebrow: 'Pravni dokument',
});

export default function PolitikaPrivatnostiPage() {
    return (
        <Container maxWidth="sm">
            <Stack>
                <PageHeader
                    padded
                    header="Politika privatnosti"
                    subHeader="Kako Gredice obrađuju podatke o računu, vrtu, narudžbama i korištenju usluga te kako ostvariti svoja prava."
                />
                <StyledHtml>
                    <h2>Tko obrađuje tvoje podatke</h2>
                    <p>
                        Voditelj obrade je Gredice društvo s ograničenom
                        odgovornošću za proizvodnju, trgovinu i usluge, OIB
                        86171547809, Ulica Julija Knifera 3, 10000 Zagreb,
                        Hrvatska. Za pitanja i zahtjeve vezane uz osobne podatke
                        piši na{' '}
                        <a href="mailto:kontakt@gredice.com">
                            kontakt@gredice.com
                        </a>
                        . Ova politika obuhvaća javnu web stranicu, aplikaciju
                        Moj vrt i povezane Gredice usluge.
                    </p>
                    <h2>Podaci, svrhe i pravne osnove</h2>
                    <h3>Račun, prijava i sigurnost</h3>
                    <p>
                        Obrađujemo podatke potrebne za registraciju i prijavu,
                        identifikator računa, adresu e-pošte, prikazno ime i
                        odabranu profilnu sliku. Kada odabereš prijavu putem
                        Googlea ili Facebooka, primamo podatke koje ta usluga
                        dostavi u okviru odobrene prijave. Svrha je omogućiti
                        pristup i izvršiti ugovor o korištenju usluge.
                    </p>
                    <p>
                        Tehničke i sigurnosne zapise koristimo za zaštitu
                        računa, sprječavanje zlouporabe i otklanjanje smetnji,
                        na temelju legitimnog interesa za sigurnu uslugu. To ne
                        znači da se svako analitičko ili marketinško praćenje
                        smatra nužnim za sigurnost.
                    </p>
                    <h3>Vrt, narudžbe, plaćanja i dostava</h3>
                    <p>
                        Za izvršenje narudžbe obrađujemo odabrane proizvode i
                        radnje, vrt i gredicu na koje se odnose, status
                        izvršenja, fotografije vrta, stanje i promjene salda te
                        potrebne kontaktne i dostavne podatke. Pružatelj
                        plaćanja obrađuje kartične podatke, a Gredice obrađuju
                        podatke o transakciji i njezinu statusu. Račune i druge
                        obvezne poslovne evidencije obrađujemo radi ispunjavanja
                        zakonskih obveza.
                    </p>
                    <h3>Podrška, povratne informacije i prigovori</h3>
                    <p>
                        Obrađujemo sadržaj upita, prigovora, povratne
                        informacije ili odgovora na anketu te podatke potrebne
                        da ih povežemo s relevantnom uslugom. Pravna osnova
                        ovisi o svrsi: izvršenje ugovora i radnje prije njegova
                        sklapanja, zakonska obveza rješavanja prigovora ili
                        legitimni interes za odgovor na opći upit i poboljšanje
                        usluge. Ne šalji podatke drugih osoba koji nisu potrebni
                        za rješavanje zahtjeva.
                    </p>
                    <h3>Javni profili i vrtovi</h3>
                    <p>
                        Na javnom profilu prikazuju se prikazno ime, profilna
                        slika, datum pridruživanja i javna postignuća. Javno
                        objavljeni vrtovi i podaci o njihovim članovima mogu se
                        vidjeti na javnim stranicama Gredica. Takav sadržaj
                        dostupan je i osobama koje nisu prijavljene te ga
                        tražilice mogu indeksirati. Adresa e-pošte za prijavu
                        nije namijenjena javnom prikazu.
                    </p>
                    <p>
                        Javni prikaz služi predstavljanju vrtova i zajednice. Za
                        pitanja o objavljenim podacima, njihovu ispravku,
                        uklanjanju ili prigovoru na obradu obrati nam se na
                        navedeni kontakt.
                    </p>
                    <h3>Obavijesti i marketing</h3>
                    <p>
                        Obavijesti potrebne za račun, narudžbu ili sigurnost
                        razlikuju se od promotivnih poruka. Za newsletter i
                        druge promotivne poruke za koje tražimo privolu
                        koristimo adresu e-pošte i podatak o prijavi na
                        pretplatu. Privolu možeš povući poveznicom za odjavu u
                        poruci ili slanjem zahtjeva. Povlačenje ne utječe na
                        zakonitost ranije obrade i ne zaustavlja obavijesti
                        potrebne za izvršenje postojeće narudžbe.
                    </p>
                    <h3>Analitika i dijagnostika</h3>
                    <p>
                        PostHog koristimo za analizu korištenja, događaje u
                        aplikaciji i dijagnostiku pogrešaka. Ti podaci mogu
                        uključivati posjećene stranice, radnje, pseudonimni
                        identifikator, podatke o pregledniku i uređaju te,
                        ovisno o događaju, poveznicu s korisničkim računom.
                        Pseudonimni podatak nije isto što i anoniman podatak.
                        Vercel Analytics služi mjerenju posjećenosti.
                    </p>
                    <p>
                        Za neobvezno praćenje putem kolačića i slične pohrane
                        potrebna je prethodna privola. Samo korištenje stranice
                        nije privola. O vrstama pohrane i upravljanju pročitaj{' '}
                        <a href={KnownPages.LegalCookies}>Politiku kolačića</a>.
                    </p>
                    <p>
                        Kada je uključeno mjerenje oglasa putem Mete, obrada
                        može obuhvatiti posjećenu stranicu, IP adresu, podatke o
                        pregledniku i postojeće identifikatore oglasa. Slanje
                        preko poslužitelja ne uklanja obvezu odgovarajuće pravne
                        osnove i potrebne privole. Prijava putem Facebooka
                        zasebna je svrha i sama po sebi nije pristanak na
                        oglašivačko praćenje.
                    </p>
                    <h3>Suncokret AI i vanjske integracije</h3>
                    <p>
                        Kada koristiš Suncokret AI, sadržaj poruka i priloženih
                        fotografija te podaci o vrtu potrebni za odgovor mogu se
                        obrađivati putem pružatelja AI usluge. Razgovori se
                        pohranjuju kako bi im mogao pristupiti u aplikaciji.
                        Obrada potrebna za odgovor na tvoj zahtjev služi
                        pružanju odabrane usluge. Izbjegavaj unošenje
                        osjetljivih ili tuđih osobnih podataka koji nisu
                        potrebni za upit.
                    </p>
                    <p>
                        Kada povezuješ vanjsku aplikaciju, podaci i radnje
                        kojima može pristupiti ovise o odobrenom pristupu.
                        Vanjska aplikacija može biti zaseban voditelj obrade
                        prema vlastitoj politici privatnosti. Automatizirani AI
                        odgovor sam po sebi nije odluka o tvojim pravima niti
                        potvrda narudžbe.
                    </p>
                    <h2>Tko može primiti podatke</h2>
                    <p>
                        Podatke u potrebnom opsegu obrađuju ovlaštene osobe koje
                        pružaju podršku, partnerski izvođači vrtnih radnji i
                        dostave te pružatelji hostinga, pohrane, e-pošte,
                        plaćanja, prijave, analitike i AI usluga. Podatke možemo
                        dostaviti i nadležnom tijelu kada postoji zakonska
                        obveza. Aktualni opis usluga nalazi se na stranici{' '}
                        <a href={KnownPages.LegalThirdParty}>Treće strane</a>.
                    </p>
                    <p>
                        Izvršitelji obrade postupaju prema odgovarajućem ugovoru
                        i uputama. Neki primatelji, primjerice pružatelji
                        pojedinih platnih ili vanjskih usluga, mogu za dio
                        obrade postupati kao samostalni voditelji obrade.
                    </p>
                    <h2>Obrada izvan Europskog gospodarskog prostora</h2>
                    <p>
                        Odabir europske lokacije poslužitelja sam po sebi ne
                        znači da je sva obrada ograničena na Europu. Kod
                        prijenosa osobnih podataka izvan Europskog gospodarskog
                        prostora potreban je odgovarajući mehanizam, primjerice
                        odluka o primjerenosti ili standardne ugovorne klauzule
                        i dodatne mjere kada su potrebne. Informacije o
                        primateljima i zaštitnim mjerama koje se odnose na tvoje
                        podatke možeš zatražiti putem našeg kontakta.
                    </p>
                    <h2>Koliko dugo čuvamo podatke</h2>
                    <p>
                        Razdoblje čuvanja određuje se prema svrsi, statusu
                        računa i narudžbe, zakonskim obvezama te potrebi
                        ostvarivanja ili obrane pravnih zahtjeva. Podaci
                        potrebni za aktivan račun i narudžbe razlikuju se od
                        računa i poslovnih evidencija koje je potrebno čuvati i
                        nakon zatvaranja računa.
                    </p>
                    <p>
                        Evidenciju pisanih prigovora čuvamo najmanje godinu dana
                        od primitka, a povezane podatke dulje samo ako za to
                        postoji druga primjenjiva obveza ili opravdana potreba.
                        Za newsletter je relevantna pretplata i njezino
                        povlačenje; može ostati podatak potreban da se poštuje
                        odjava ili dokaže ranije dana privola. Za dijagnostiku,
                        fotografije i AI razgovore rok treba odgovarati njihovoj
                        svrsi i potrebama rješavanja zahtjeva. Zahtjev za
                        brisanje procjenjujemo i u odnosu na obvezne evidencije
                        i sigurnosne kopije.
                    </p>
                    <h2>Zaštita podataka</h2>
                    <p>
                        Primjenjujemo odgovarajuće tehničke i organizacijske
                        mjere, uključujući ograničavanje pristupa, zaštitu
                        prijave i prijenosa podataka te postupanje sa
                        sigurnosnim incidentima. Mjere se odabiru prema riziku
                        obrade; nijedan sustav ne može jamčiti potpunu
                        sigurnost.
                    </p>
                    <h2>Tvoja prava i način podnošenja zahtjeva</h2>
                    <ul>
                        <li>
                            Možeš zatražiti pristup i kopiju svojih podataka te
                            ispravak netočnih podataka.
                        </li>
                        <li>
                            Možeš zatražiti brisanje ili ograničenje obrade kada
                            su ispunjeni zakonski uvjeti.
                        </li>
                        <li>
                            Možeš uložiti prigovor na obradu koja se temelji na
                            legitimnom interesu, a na izravni marketing u svakom
                            trenutku.
                        </li>
                        <li>
                            Imaš pravo na prenosivost podataka kada se
                            automatizirana obrada temelji na privoli ili ugovoru
                            i ispunjeni su ostali uvjeti.
                        </li>
                        <li>
                            Privolu možeš povući bez utjecaja na zakonitost
                            obrade prije povlačenja.
                        </li>
                    </ul>
                    <p>
                        Zahtjev pošalji na{' '}
                        <a href="mailto:kontakt@gredice.com">
                            kontakt@gredice.com
                        </a>
                        . Odgovaramo bez nepotrebnog odgađanja, u pravilu u roku
                        od mjesec dana. Ako je potrebno zakonski dopušteno
                        produljenje, o razlogu i produljenju obavijestit ćemo te
                        u tom roku. Radi zaštite podataka možemo tražiti
                        razmjernu provjeru identiteta.
                    </p>
                    <p>
                        Pritužbu možeš podnijeti{' '}
                        <a href="https://azop.hr/">
                            Agenciji za zaštitu osobnih podataka (AZOP)
                        </a>
                        . Podatke potrebne za ugovor ili zakonsku obvezu moramo
                        imati kako bismo pružili odgovarajuću uslugu; neobvezne
                        podatke možeš uskratiti bez gubitka drugih usluga za
                        koje nisu potrebni.
                    </p>
                    <h2>Promjene politike</h2>
                    <p>
                        Na ovoj stranici objavljujemo izmjene s datumom. Ako se
                        mijenja svrha ili drugi bitan uvjet obrade, pružit ćemo
                        potrebne informacije, a novu privolu zatražiti kada je
                        ona potrebna. Objava politike ne zamjenjuje privolu.
                    </p>
                </StyledHtml>
                <Typography level="body2" secondary className="mt-8">
                    Zadnja izmjena: 22. rujna 2026.
                </Typography>
            </Stack>
        </Container>
    );
}
