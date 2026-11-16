import { Container } from '@gredice/ui/Container';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import { StyledHtml } from '@gredice/ui/StyledHtml';
import { Typography } from '@gredice/ui/Typography';
import { createPublicMetadata } from '../../../lib/seo/publicMetadata';
import { KnownPages } from '../../../src/KnownPages';

export const metadata = createPublicMetadata({
    title: 'Politika kolačića',
    description:
        'Kolačići, pohrana u pregledniku, analitika i tvoja prava pri korištenju Gredica.',
    path: KnownPages.LegalCookies,
    eyebrow: 'Pravni dokument',
});

export default function PolitikaKolacicaPage() {
    return (
        <Container maxWidth="sm">
            <Stack>
                <PageHeader
                    padded
                    header="Politika kolačića"
                    subHeader="Kolačići, pohrana u pregledniku, analitika i tvoja prava pri korištenju Gredica."
                />
                <StyledHtml>
                    <h2>Što obuhvaća ova politika</h2>
                    <p>
                        Kolačići su male datoteke koje preglednik sprema na
                        uređaj. Sličnu ulogu mogu imati lokalna pohrana i
                        pohrana sesije. Ova politika odnosi se na te tehnologije
                        na web stranici i u aplikaciji Gredice, kojima upravlja
                        Gredice d.o.o., Ulica Julija Knifera 3, 10000 Zagreb,
                        OIB 86171547809.
                    </p>
                    <h2>Prijava, sigurnost i odabrane postavke</h2>
                    <p>
                        Pohrana potrebna za prijavu omogućuje pristup računu i
                        zaštitu sesije. Njezino trajanje ovisi o sesiji i
                        odabranoj prijavi. Brisanje ili blokiranje takve pohrane
                        može te odjaviti ili onemogućiti pristup zaštićenom
                        dijelu aplikacije.
                    </p>
                    <p>
                        U pregledniku se mogu sačuvati i tvoji odabiri prikaza,
                        poput teme i sezonskog izgleda. Lokalna pohrana može
                        ostati nakon zatvaranja preglednika, dok je pohrana
                        sesije vezana uz sesiju pregledavanja. To treba
                        razlikovati od praćenja korištenja radi analitike ili
                        oglašavanja.
                    </p>
                    <h2>Analitika i dijagnostika</h2>
                    <p>
                        PostHog koristimo za analizu posjećenih stranica i
                        radnji u aplikaciji te dijagnostiku pogrešaka. Može
                        koristiti kolačić čiji naziv počinje s <code>ph_</code>{' '}
                        i završava s <code>_posthog</code>, kao i lokalnu
                        pohranu i pohranu sesije. One mogu sadržavati
                        pseudonimni identifikator i podatke koji povezuju
                        događaje u sesiji. To nisu kolačići za samu prijavu u
                        Gredice.
                    </p>
                    <p>
                        PostHogove mogućnosti mogu uključivati analizu
                        interakcija i snimanje sesije, ovisno o uključenim
                        postavkama. Pseudonimni identifikator ne znači da su
                        podaci anonimni. Vercel Analytics također služi mjerenju
                        posjećenosti; način rada pojedinog alata treba
                        razlikovati od PostHogove pohrane.
                    </p>
                    <h2>Vanjske usluge i mjerenje oglasa</h2>
                    <p>
                        Plaćanje, vanjska prijava i prikaz karte mogu
                        uključivati usluge drugih pružatelja. Kada ih koristiš,
                        primjenjuju se i informacije tih pružatelja o njihovoj
                        obradi. Njihove svrhe opisujemo na stranici{' '}
                        <a href={KnownPages.LegalThirdParty}>Treće strane</a>.
                    </p>
                    <p>
                        Kada je uključeno mjerenje oglasa putem Mete, mogu se
                        koristiti postojeći identifikatori <code>_fbp</code> i{' '}
                        <code>_fbc</code> te podaci o posjetu. Slanje događaja
                        putem poslužitelja ne znači da za obradu nije potrebna
                        odgovarajuća pravna osnova ili privola.
                    </p>
                    <h2>Privola i upravljanje pohranom</h2>
                    <p>
                        Za neobvezno analitičko i marketinško praćenje putem
                        kolačića ili sličnih tehnologija potrebna je prethodna
                        privola. Nastavak pregledavanja, otvaranje računa ili
                        prihvaćanje uvjeta korištenja nisu sami po sebi takva
                        privola. Odbijanje neobveznog praćenja ne smije
                        onemogućiti osnovnu uslugu, a povlačenje privole mora
                        biti jednako jednostavno kao njezino davanje.
                    </p>
                    <p>
                        U postavkama preglednika možeš pregledati i izbrisati
                        kolačiće te pohranu pojedine stranice ili ograničiti
                        njihovo spremanje. Brisanje lokalne pohrane može
                        ukloniti i zapamćene postavke. Te mogućnosti preglednika
                        ne zamjenjuju obvezu Gredica da pribave potrebnu
                        privolu, a brisanje kolačića ne briše automatski podatke
                        već obrađene na poslužitelju.
                    </p>
                    <h2>Trajanje pohrane i tvoja prava</h2>
                    <p>
                        Trajanje ovisi o vrsti pohrane i postavkama usluge.
                        Kolačić može isteći, dok lokalna pohrana može ostati do
                        uklanjanja. Informacije o obradi, rokovima odnosno
                        kriterijima čuvanja i ostvarivanju prava opisane su u{' '}
                        <a href={KnownPages.LegalPrivacy}>
                            Politici privatnosti
                        </a>
                        .
                    </p>
                    <p>
                        Za podatke o konkretnoj pohrani ili zahtjev vezan uz
                        tvoje podatke piši na{' '}
                        <a href="mailto:kontakt@gredice.com">
                            kontakt@gredice.com
                        </a>
                        . Promjene ove politike objavljujemo uz datum izmjene.
                    </p>
                </StyledHtml>
                <Typography level="body2" secondary className="mt-8">
                    Zadnja izmjena: 22. rujna 2026.
                </Typography>
            </Stack>
        </Container>
    );
}
