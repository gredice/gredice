import { Container } from '@gredice/ui/Container';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import { StyledHtml } from '@gredice/ui/StyledHtml';
import { Typography } from '@gredice/ui/Typography';
import { createPublicMetadata } from '../../../lib/seo/publicMetadata';
import { KnownPages } from '../../../src/KnownPages';

export const metadata = createPublicMetadata({
    title: 'Uvjeti korištenja',
    description:
        'Pravila korištenja Gredica, naručivanja vrtnih usluga, salda i zaštite tvojih prava.',
    path: KnownPages.LegalTerms,
    eyebrow: 'Pravni dokument',
});

export default function UvjetiKoristenjaPage() {
    return (
        <Container maxWidth="sm">
            <Stack>
                <PageHeader
                    padded
                    header="Uvjeti korištenja"
                    subHeader="Pravila korištenja Gredica, naručivanja vrtnih usluga, salda i zaštite tvojih prava."
                />
                <StyledHtml>
                    <h2>O Gredicama i ovim uvjetima</h2>
                    <p>
                        Gredice društvo s ograničenom odgovornošću za
                        proizvodnju, trgovinu i usluge, OIB 86171547809, Ulica
                        Julija Knifera 3, 10000 Zagreb, Hrvatska, upravlja web
                        stranicom i aplikacijom Gredice. Javi nam se na{' '}
                        <a href="mailto:kontakt@gredice.com">
                            kontakt@gredice.com
                        </a>{' '}
                        ili telefonom na{' '}
                        <a href="tel:+385993447418">+385 99 344 7418</a>. Ostali
                        podaci dostupni su na stranici{' '}
                        <a href={KnownPages.LegalCompany}>Tvrtka</a>.
                    </p>
                    <p>
                        Ovi uvjeti odnose se na korištenje javne web stranice i
                        aplikacije Moj vrt te naručivanje proizvoda i usluga
                        kroz Gredice. Konkretna ponuda i potvrda narudžbe
                        određuju što je naručeno i po kojoj cijeni. Obvezna
                        prava potrošača imaju prednost pred odredbom ovih uvjeta
                        koja bi ih ograničavala.
                    </p>
                    <h2>Vrt, uzgoj i narudžbe</h2>
                    <p>
                        U aplikaciji planiraš vrt i naručuješ radnje, a fizički
                        uzgoj, održavanje i berba provode se na partnerskom
                        OPG-u. Prikaz vrta u aplikaciji služi planiranju i
                        praćenju stvarnih radnji. Opis gredice, biljke ili
                        radnje treba čitati zajedno s ponudom koju naručuješ.
                    </p>
                    <p>
                        Prije naručivanja provjeri sadržaj i cijenu ponude,
                        uključene radnje, eventualne dodatne troškove i podatke
                        o dostavi. Ako trajanje usluge, opseg održavanja ili
                        uvjeti prestanka nisu jasni iz ponude, zatraži
                        pojašnjenje prije plaćanja. Ne smatra se da si naručio
                        dodatnu plaćenu radnju samo zato što je prikazana kao
                        preporuka.
                    </p>
                    <p>
                        Rast biljaka i vrijeme berbe ovise o kulturi, sezoni i
                        uvjetima uzgoja. Procijenjeni rok ili urod nije jamstvo
                        određene količine, osim kada je takvo jamstvo dio
                        konkretne ponude. Prirodni rizici ne isključuju
                        odgovornost za neizvršene obveze ili propuste pri
                        pružanju usluge.
                    </p>
                    <p>
                        Uvjeti, područje, cijena i termini dostave opisani su na
                        stranici <a href={KnownPages.Delivery}>Dostava</a>. Za
                        promjenu ili otkazivanje narudžbe javi se što prije.
                        Mogućnost zaustavljanja već započete radnje ovisi o
                        njezinu statusu, bez utjecaja na zakonsko pravo na
                        raskid i druga prava koja ti pripadaju.
                    </p>
                    <h2>Suncokreti i saldo</h2>
                    <p>
                        Suncokreti su Gredice bodovi za vrtne radnje i povezane
                        usluge. Evidentiraju se na korisničkom računu, koriste
                        se unutar Gredica i ne prenose se na druge korisnike.
                        Cijena paketa, broj suncokreta i eventualni bonus
                        prikazani su u ponudi. Orijentacijski odnos prema euru
                        nije obećanje isplate svakog boda u novcu.
                    </p>
                    <p>
                        Kod naručivanja radnje saldo se može rezervirati.
                        Otkazivanje prije obrade otpušta rezervaciju na
                        raspoloživi saldo; nakon izvršenja radnja se naplaćuje
                        iz rezerviranog iznosa. Otpuštanje rezervacije razlikuje
                        se od povrata prethodno uplaćenog novca.
                    </p>
                    <p>
                        Bonus bodovi ne predstavljaju zasebnu novčanu uplatu.
                        Ipak, korištenje salda ili dodjela bonusa ne isključuju
                        zakonski obvezan povrat plaćenog iznosa. Pojedinosti su
                        na stranicama{' '}
                        <a href={KnownPages.Sunflowers}>Suncokreti</a> i{' '}
                        <a href={KnownPages.Refunds}>Povrat novca</a>.
                    </p>
                    <h2>Korisnički račun i sadržaj</h2>
                    <p>
                        Čuvaj podatke za prijavu, navedi točne podatke potrebne
                        za narudžbu i dostavu te prijavi sumnju na neovlašten
                        pristup. Za sklapanje ugovora moraš imati potrebnu
                        poslovnu sposobnost ili odgovarajuće sudjelovanje
                        zakonskog zastupnika.
                    </p>
                    <p>
                        Nemoj objavljivati nezakonit, obmanjujući ili uvredljiv
                        sadržaj, otkrivati tuđe osobne podatke bez osnove niti
                        kršiti prava drugih. Sadržaj koji prenosiš moraš imati
                        pravo koristiti. Njegovo objavljivanje ne prenosi tvoje
                        vlasništvo na Gredice; smijemo ga obrađivati i
                        prikazivati u opsegu potrebnom za funkcionalnost za koju
                        je dostavljen.
                    </p>
                    <p>
                        Javni profil i javno prikazani vrtovi mogu biti dostupni
                        drugim posjetiteljima. Podaci koji se obrađuju i tvoja
                        prava opisani su u{' '}
                        <a href={KnownPages.LegalPrivacy}>
                            Politici privatnosti
                        </a>
                        . Odobrenje pristupa vanjskoj aplikaciji treba
                        odgovarati radnjama koje joj želiš omogućiti.
                    </p>
                    <p>
                        Suncokret AI pruža automatizirane odgovore koji mogu
                        biti netočni ili nepotpuni. Provjeri preporuku prije
                        primjene u vrtu. Prikaz preporuke sam po sebi nije
                        potvrda da je radnja naručena ili izvršena.
                    </p>
                    <h2>Dostupnost, ograničenje pristupa i odgovornost</h2>
                    <p>
                        Održavanje i tehničke smetnje mogu privremeno utjecati
                        na dostupnost. Pristup možemo ograničiti kada je to
                        potrebno radi sigurnosti, sprječavanja zlouporabe,
                        zaštite drugih osoba ili postupanja prema zakonu.
                        Ograničenje treba biti razmjerno razlogu; kada je
                        moguće, obavijestit ćemo te o razlogu i načinu obraćanja
                        podršci. Hitna sigurnosna mjera može prethoditi
                        obavijesti.
                    </p>
                    <p>
                        Ograničenje pristupa ili prestanak dostupnosti
                        aplikacije ne ukidaju naša prava i obveze iz već
                        sklopljenih ugovora, uključujući rješavanje neizvršenih
                        narudžbi i zakonski obvezne povrate. Za pomoć s
                        postojećom narudžbom možeš se obratiti na navedenu
                        adresu e-pošte.
                    </p>
                    <p>
                        Za štetu i ispunjenje ugovornih obveza odgovaramo prema
                        primjenjivim propisima. Ovim uvjetima ne isključujemo
                        odgovornost koju zakon ne dopušta isključiti niti
                        ograničavamo zakonska prava zbog nedostatka proizvoda
                        ili neuredno pružene usluge.
                    </p>
                    <h2>Intelektualno vlasništvo</h2>
                    <p>
                        Na izvorni kod primjenjuje se licenca opisana na
                        stranici{' '}
                        <a href={KnownPages.LegalLicense}>
                            Licenca izvornog koda
                        </a>
                        . Ovi uvjeti ne ograničavaju prava dana tom licencom. Za
                        sadržaj, oznake i materijale drugih nositelja prava
                        vrijede njihove primjenjive licence i zakonska pravila.
                    </p>
                    <h2>Raskid, povrati i prigovori</h2>
                    <p>
                        Postupak ostvarivanja prava na raskid, povrat i
                        reklamaciju opisan je na stranici{' '}
                        <a href={KnownPages.Refunds}>Povrat novca</a>.
                        Dobrovoljna pogodnost povrata ne zamjenjuje zakonska
                        prava potrošača.
                    </p>
                    <p>
                        Pisani prigovor možeš poslati na{' '}
                        <a href="mailto:kontakt@gredice.com">
                            kontakt@gredice.com
                        </a>{' '}
                        ili poštom na Gredice d.o.o., Ulica Julija Knifera 3,
                        10000 Zagreb. Primitak potvrđujemo bez odgađanja, a
                        pisano odgovaramo u roku od 15 dana od primitka. Upute
                        su dostupne i na stranici{' '}
                        <a href={KnownPages.Contact}>Kontakt</a>.
                    </p>
                    <h2>Izmjene uvjeta i rješavanje sporova</h2>
                    <p>
                        Na stranici navodimo datum izmjene uvjeta. Nova objava
                        sama po sebi ne mijenja cijenu, sadržaj ni druga prava
                        iz već sklopljene narudžbe. Za promjene postojećeg
                        ugovora vrijede ugovoreni uvjeti i obvezni propisi,
                        uključujući obavijest, suglasnost ili pravo na prestanak
                        kada su potrebni.
                    </p>
                    <p>
                        Primjenjuje se pravo Republike Hrvatske, uz očuvanje
                        obvezne zaštite potrošača koja se ne može isključiti
                        izborom prava. Nadležnost suda određuje se prema
                        primjenjivim propisima; ovi uvjeti ne oduzimaju
                        potrošaču pravo na zakonom nadležan sud. Prije
                        pokretanja postupka možeš nam se obratiti radi pokušaja
                        mirnog rješenja spora.
                    </p>
                </StyledHtml>
                <Typography level="body2" secondary className="mt-8">
                    Zadnja izmjena: 22. rujna 2026.
                </Typography>
            </Stack>
        </Container>
    );
}
