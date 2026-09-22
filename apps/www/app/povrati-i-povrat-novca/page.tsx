import { Container } from '@gredice/ui/Container';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import { StyledHtml } from '@gredice/ui/StyledHtml';
import { Typography } from '@gredice/ui/Typography';
import { createPublicMetadata } from '../../lib/seo/publicMetadata';
import { KnownPages } from '../../src/KnownPages';

export const metadata = createPublicMetadata({
    title: 'Povrat novca',
    description:
        'Zakonska prava na raskid i reklamaciju, dobrovoljni povrat u roku od 30 dana te povrati Gredice salda.',
    path: KnownPages.Refunds,
    eyebrow: 'Pravni dokument',
});

export default function RefundsPage() {
    return (
        <Container maxWidth="md">
            <Stack>
                <PageHeader
                    padded
                    header="Povrat novca"
                    subHeader="Zakonska prava na raskid i reklamaciju, dobrovoljni povrat u roku od 30 dana te povrati Gredice salda."
                />
                <StyledHtml>
                    <h2>Zakonska prava i naša dodatna pogodnost</h2>
                    <p>
                        Pravo na jednostrani raskid ugovora, prava zbog
                        nedostatka proizvoda ili neizvršene usluge i naša
                        dobrovoljna politika povrata različite su osnove
                        zahtjeva. Dobrovoljni rok od 30 dana ne ograničava
                        rokove ni prava koja ti pripadaju po zakonu.
                    </p>
                    <h2>Jednostrani raskid ugovora na daljinu</h2>
                    <p>
                        Kada postoji zakonsko pravo na jednostrani raskid,
                        ugovor možeš raskinuti u roku od 14 dana bez navođenja
                        razloga. Za usluge rok u pravilu počinje sklapanjem
                        ugovora, a za robu predajom robe tebi ili osobi koju
                        odrediš, osim prijevozniku. Za posebne načine isporuke
                        vrijede odgovarajuća zakonska pravila.
                    </p>
                    <p>
                        Nedvosmislenu izjavu o raskidu možeš poslati na{' '}
                        <a href="mailto:kontakt@gredice.com">
                            kontakt@gredice.com
                        </a>{' '}
                        ili poštom na Gredice d.o.o., Ulica Julija Knifera 3,
                        10000 Zagreb. Dovoljno je poslati izjavu prije isteka
                        primjenjivog roka. Broj narudžbe olakšava pronalazak
                        ugovora, ali nije jedini način njegova prepoznavanja.
                        Zakonsko pravo na raskid ne ovisi o diskrecijskom
                        odobrenju podrške.
                    </p>
                    <h3>Primjer izjave o raskidu</h3>
                    <p>
                        Primatelj: Gredice d.o.o., Ulica Julija Knifera 3, 10000
                        Zagreb, kontakt@gredice.com.
                    </p>
                    <p>
                        Ovime izjavljujem da jednostrano raskidam ugovor za
                        sljedeću robu ili uslugu: [opis i, ako je poznat, broj
                        narudžbe]. Datum narudžbe odnosno primitka robe:
                        [datum]. Ime i prezime: [ime]. Adresa: [adresa]. Datum
                        izjave: [datum]. Potpis je potreban ako izjavu šalješ na
                        papiru.
                    </p>
                    <p>
                        Možeš koristiti ovaj primjer ili drugu jasnu izjavu.
                        Primitak izjave poslane elektronički potvrđujemo bez
                        odgađanja.
                    </p>
                    <h3>Iznimke i početak pružanja usluge</h3>
                    <p>
                        Za lako pokvarljivu robu, kao što je svježe povrće,
                        zakonsko pravo na odustanak bez razloga može biti
                        isključeno. To ne isključuje prava zbog neispravnosti,
                        nesukladnosti ili neizvršene isporuke. Sama činjenica da
                        je narudžba vođena digitalno ne čini svaku robu ili
                        vrtnu uslugu digitalnim sadržajem.
                    </p>
                    <p>
                        Ako izričito zatražiš početak usluge prije isteka roka
                        za raskid, pri raskidu možeš biti dužan platiti
                        razmjeran dio već pružene usluge kada su ispunjeni
                        zakonski uvjeti. Gubitak prava nakon potpunog izvršenja
                        naplatne usluge zahtijeva propisani prethodni pristanak
                        i potvrdu da razumiješ tu posljedicu; ne nastupa samim
                        otvaranjem računa.
                    </p>
                    <h3>Povrat plaćenog iznosa i robe</h3>
                    <p>
                        Kod valjanog zakonskog raskida plaćeni iznos vraćamo bez
                        nepotrebnog odgađanja, najkasnije u roku od 14 dana od
                        primitka obavijesti, uz zakonom dopuštene iznimke za
                        zadržavanje povrata do primitka robe ili dokaza o
                        slanju. Povrat uključuje trošak standardne dostave kada
                        je primjenjivo i provodi se istim sredstvom plaćanja,
                        osim ako izričito pristaneš na drugo bez dodatnog
                        troška.
                    </p>
                    <p>
                        Ako raskid uključuje robu koju je potrebno vratiti,
                        vrati je bez nepotrebnog odgađanja, najkasnije u roku od
                        14 dana od slanja izjave, prema uputama za povrat. O
                        izravnim troškovima povrata moraš biti obaviješten prije
                        sklapanja ugovora; ako takva obavijest nije dana, ne
                        snosiš ih. Ove upute ne odnose se na radnju u vrtu koja
                        po svojoj prirodi nije fizički proizvod za slanje.
                    </p>
                    <h2>Neispravan proizvod ili neizvršena usluga</h2>
                    <p>
                        Ako proizvod ima nedostatak, dostava nije uredna ili
                        dogovorena radnja nije izvršena, javi nam što se
                        dogodilo. Prema okolnostima i zakonu možeš ostvariti
                        ispunjenje obveze, otklanjanje nedostatka, zamjenu,
                        sniženje cijene ili raskid i povrat. Ne moraš svoj
                        zahtjev podvesti pod našu dobrovoljnu pogodnost od 30
                        dana.
                    </p>
                    <p>
                        Kod svježeg uroda javi se čim primijetiš problem kako
                        bismo mogli provjeriti stanje. Fotografija i podaci o
                        narudžbi pomažu, ali ne zamjenjuju zakonska pravila niti
                        su opći uvjet za svako pravo.
                    </p>
                    <h2>Dobrovoljna pogodnost u roku od 30 dana</h2>
                    <p>
                        Za biljke i radnje kupljene kroz Gredice na tržištu
                        Hrvatske možeš nam se javiti zbog nezadovoljstva u roku
                        od 30 dana od kupnje. Nakon provjere zahtjeva možemo
                        odobriti puni povrat ili, uz tvoj dogovor, kredit u
                        suncokretima. Za ovu dodatnu pogodnost ne tražimo
                        fizički povrat biljke iz gredice. Ona ne zamjenjuje
                        zakonski povrat robe kada je taj povrat potreban niti
                        ograničava druga prava.
                    </p>
                    <h2>Suncokreti i rezervacije</h2>
                    <p>
                        Otkazivanje radnje prije obrade otpušta rezervirane
                        suncokrete na raspoloživi saldo. To je oslobađanje
                        rezervacije, a ne automatski povrat kartične uplate. Za
                        povrat uplate ili korekciju već naplaćene radnje obrati
                        nam se s podacima o paketu ili narudžbi.
                    </p>
                    <p>
                        Bonus suncokreti nisu zasebna novčana uplata. Kod
                        povrata treba razlikovati stvarno plaćeni iznos, već
                        iskorištene radnje i dodijeljeni bonus. Bonus niti
                        interna evidencija u bodovima ne mogu isključiti
                        zakonski obvezan povrat novca. Zamjena takvog povrata
                        suncokretima moguća je samo uz odgovarajući izričit
                        dogovor.
                    </p>
                    <h2>Pisani prigovor i kontakt</h2>
                    <p>
                        Pisani prigovor pošalji na{' '}
                        <a href="mailto:kontakt@gredice.com">
                            kontakt@gredice.com
                        </a>{' '}
                        ili poštom na Gredice d.o.o., Ulica Julija Knifera 3,
                        10000 Zagreb. Primitak potvrđujemo bez odgađanja, a
                        pisani odgovor, s očitovanjem o osnovanosti prigovora,
                        šaljemo u roku od 15 dana od primitka.
                    </p>
                    <p>
                        Ostale kontakte pronađi na stranici{' '}
                        <a href={KnownPages.Contact}>Kontakt</a>, a povezane
                        informacije na stranicama{' '}
                        <a href={KnownPages.LegalTerms}>Uvjeti korištenja</a>,{' '}
                        <a href={KnownPages.Sunflowers}>Suncokreti</a> i{' '}
                        <a href={KnownPages.Delivery}>Dostava</a>.
                    </p>
                </StyledHtml>
                <Typography level="body2" secondary className="mt-8">
                    Zadnja izmjena: 22. rujna 2026.
                </Typography>
            </Stack>
        </Container>
    );
}
