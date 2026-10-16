import { Container } from '@gredice/ui/Container';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import { StyledHtml } from '@gredice/ui/StyledHtml';
import { Typography } from '@gredice/ui/Typography';
import { createPublicMetadata } from '../../../lib/seo/publicMetadata';
import { KnownPages } from '../../../src/KnownPages';

export const metadata = createPublicMetadata({
    title: 'Treće strane',
    description:
        'Pružatelji usluga, primatelji podataka i alati koje Gredice koriste.',
    path: KnownPages.LegalThirdParty,
    eyebrow: 'Pravni dokument',
});

export default function ThirdPartiesPage() {
    return (
        <Container maxWidth="sm">
            <Stack>
                <PageHeader
                    padded
                    header="Treće strane"
                    subHeader="Pružatelji usluga, primatelji podataka i alati koje Gredice koriste."
                />
                <StyledHtml>
                    <h2>Čemu služe vanjske usluge</h2>
                    <p>
                        Gredice koriste vanjske usluge za rad aplikacije,
                        izvršavanje narudžbi i pojedine funkcionalnosti koje
                        odabereš. Ova stranica opisuje njihove svrhe; nije
                        zamjena za{' '}
                        <a href={KnownPages.LegalPrivacy}>
                            Politiku privatnosti
                        </a>{' '}
                        ni za pravnu osnovu potrebnu za pojedinu obradu.
                    </p>
                    <p>
                        Pristup podacima ovisi o usluzi i tvojem korištenju.
                        Izvršitelji obrade obrađuju podatke za Gredice, a
                        pojedini pružatelji za dio svojih usluga mogu biti
                        samostalni voditelji obrade. Samo navođenje pružatelja
                        ne znači da mu se šalju svi podaci svih korisnika.
                    </p>
                    <h2>Rad platforme i komunikacija</h2>
                    <ul>
                        <li>
                            <strong>Vercel:</strong> hosting i izvršavanje
                            aplikacije, obrada zahtjeva i tehničkih zapisa
                            potrebnih za rad usluge.
                        </li>
                        <li>
                            <strong>Neon:</strong> usluga baze podataka za
                            podatke računa, vrtova, narudžbi i povezanih
                            evidencija.
                        </li>
                        <li>
                            <strong>Microsoft Azure:</strong> usluge u oblaku;
                            Azure Communication Services koristi se za slanje
                            e-pošte, uključujući adresu primatelja i sadržaj
                            poruke.
                        </li>
                        <li>
                            <strong>Cloudflare:</strong> DNS i povezane mrežne
                            usluge, usmjeravanje dolazne e-pošte te pohrana i
                            isporuka datoteka putem R2.
                        </li>
                        <li>
                            <strong>Checkly:</strong> provjere dostupnosti i
                            ispravnosti web usluga.
                        </li>
                    </ul>
                    <h2>Plaćanje, prijava, vrt i dostava</h2>
                    <ul>
                        <li>
                            <strong>Stripe:</strong> obrada plaćanja i podataka
                            potrebnih za transakciju. Gredice primaju podatke o
                            plaćanju i njegovu statusu.
                        </li>
                        <li>
                            <strong>Google:</strong> prijava Google računom kada
                            je odabereš te usluge karata i adresa povezane s
                            provjerom dostave.
                        </li>
                        <li>
                            <strong>Meta (Facebook):</strong> prijava Facebook
                            računom kada je odabereš. Ta je svrha odvojena od
                            mjerenja oglasa.
                        </li>
                        <li>
                            <strong>Partnerski OPG i dostavljači:</strong>{' '}
                            informacije potrebne za obavljanje naručenih vrtnih
                            radnji, pripremu, preuzimanje i dostavu, uključujući
                            dostavnu adresu i kontakt kada su potrebni.
                        </li>
                    </ul>
                    <h2>Analitika, dijagnostika i oglasi</h2>
                    <ul>
                        <li>
                            <strong>PostHog:</strong> događaji korištenja i
                            pretraživanja, analiza proizvoda i dijagnostika
                            pogrešaka. Podaci mogu uključivati identifikator,
                            podatke o uređaju i povezane radnje; opseg ovisi o
                            uključenim mogućnostima.
                        </li>
                        <li>
                            <strong>Vercel Analytics:</strong> mjerenje
                            posjećenosti web stranice.
                        </li>
                        <li>
                            <strong>Meta:</strong> kada je uključeno mjerenje
                            oglasa, podaci o događaju i posjetu mogu se
                            obrađivati putem Conversions API-ja. Prijava putem
                            Facebooka ne predstavlja privolu za tu obradu.
                        </li>
                    </ul>
                    <p>
                        Za neobvezno praćenje potrebna je odgovarajuća pravna
                        osnova i privola kada je propisana. Više o pohrani u
                        pregledniku pročitaj u{' '}
                        <a href={KnownPages.LegalCookies}>Politici kolačića</a>.
                    </p>
                    <h2>AI i povezane aplikacije</h2>
                    <p>
                        Suncokret AI koristi Vercel AI Gateway i pružatelja
                        odabranog AI modela, uključujući OpenAI. Za odgovor se
                        mogu obrađivati poruke, priložene fotografije i podaci o
                        vrtu potrebni za upit. Uključivanje vanjske aplikacije
                        može omogućiti pristup podacima i radnjama unutar opsega
                        koji odobriš. Za njezinu zasebnu obradu pročitaj i
                        njezinu politiku privatnosti.
                    </p>
                    <h2>Alati za razvoj i dizajn</h2>
                    <p>
                        Za razvoj i suradnju koristimo GitHub, za dizajn Figma,
                        a za izradu 3D modela Blender. Ti alati nisu samim time
                        primatelji podataka svake narudžbe ili posjeta. Javno
                        objavljeni sadržaj, primjerice GitHub rasprava koju sam
                        objaviš, podliježe i pravilima te platforme.
                    </p>
                    <h2>Lokacije obrade i dodatne informacije</h2>
                    <p>
                        Mjesto obrade ovisi o usluzi, ugovoru i odabranoj
                        lokaciji. Ne znači da se svi podaci čuvaju isključivo u
                        Europskoj uniji. Primjenjiva pravila za međunarodne
                        prijenose i način ostvarivanja prava opisani su u{' '}
                        <a href={KnownPages.LegalPrivacy}>
                            Politici privatnosti
                        </a>
                        .
                    </p>
                    <p>
                        Za informacije o primateljima koji obrađuju tvoje
                        podatke, njihovim ulogama i zaštitnim mjerama javi se na{' '}
                        <a href="mailto:kontakt@gredice.com">
                            kontakt@gredice.com
                        </a>
                        . Popis ažuriramo kada se promijene usluge koje
                        koristimo; objava izmjene ne zamjenjuje potrebnu
                        obavijest ili privolu.
                    </p>
                </StyledHtml>
                <Typography level="body2" secondary className="mt-8">
                    Zadnja izmjena: 22. rujna 2026.
                </Typography>
            </Stack>
        </Container>
    );
}
