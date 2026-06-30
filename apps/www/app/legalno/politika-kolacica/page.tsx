import { Container } from '@gredice/ui/Container';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import { StyledHtml } from '@gredice/ui/StyledHtml';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Politika kolačića',
    description:
        'Koje kolačiće koristimo na našoj web stranici, kako ih koristimo, te koja su tvoja prava vezana uz njih.',
};

export default function PolitikaKolacicaPage() {
    return (
        <Container maxWidth="sm">
            <Stack>
                <PageHeader
                    padded
                    header="Politika kolačića"
                    subHeader="Koje kolačiće koristimo na našoj web stranici, kako ih koristimo, te koja su tvoja prava vezana uz njih."
                />
                <StyledHtml>
                    <h2>Što su kolačići?</h2>
                    <p>
                        Kolačići su male tekstualne datoteke koje se pohranjuju
                        na tvojem uređaju prilikom posjeta našoj web stranici.
                        Oni omogućuju web stranici da prepozna tvoj uređaj i
                        prikupi informacije o tvojem posjetu.
                    </p>
                    <h2>Kolačići koje koristimo</h2>
                    <p>
                        Naša web stranica koristi isključivo nužne kolačiće. Ovi
                        kolačići su bitni za ispravno funkcioniranje web
                        stranice i ne mogu se isključiti u našim sustavima.
                        Obično se postavljaju samo kao odgovor na radnje koje
                        poduzmeš, kao što su postavljanje tvojih postavki
                        privatnosti, prijava ili dovršavanje obrazaca.
                    </p>
                    <p>Primjeri nužnih kolačića uključuju:</p>
                    <ul>
                        <li>
                            <strong>Kolačići za autentikaciju</strong>: Ovi
                            kolačići omogućuju ti pristup sigurnim dijelovima
                            naše web stranice.
                        </li>
                        <li>
                            <strong>Kolačići za sesiju</strong>: Ovi kolačići
                            pomažu u omogućavanju funkcionalnosti kao što su
                            navigacija između stranica i vraćanje na prethodne
                            stranice.
                        </li>
                    </ul>
                    <h2>Kako možeš upravljati kolačićima</h2>
                    <p>
                        Većina web preglednika automatski prihvaća kolačiće, ali
                        možeš odabrati želiš li ih prihvatiti ili ne. Ako ne
                        želiš primati kolačiće, možeš postaviti preglednik da ih
                        odbija ili te upozori kada se kolačići šalju.
                    </p>
                    <p>
                        Imaj na umu da, ako onemogućiš kolačiće, neke dijelove
                        naše web stranice možda neće pravilno funkcionirati.
                    </p>
                    <h2>Tvoja prava</h2>
                    <p>
                        Imaš pravo znati koje informacije prikupljamo putem
                        kolačića i za što se koriste. Također imaš pravo
                        zatražiti brisanje ili ispravak informacija koje smo
                        prikupili.
                    </p>
                    <h2>Kontakt informacije</h2>
                    <p>
                        Ako imaš bilo kakva pitanja ili trebaš više informacija
                        o našoj politici kolačića, slobodno nas kontaktiraj
                        putem adrese e-pošte na{' '}
                        <a href="mailto:kontakt@gredice.com">
                            kontakt@gredice.com
                        </a>
                        .
                    </p>
                    <h2>Promjene u politici kolačića</h2>
                    <p>
                        Zadržavamo pravo izmjene ove politike kolačića u bilo
                        kojem trenutku. Sve izmjene bit će objavljene na ovoj
                        stranici, uz datum ažuriranja.
                    </p>
                </StyledHtml>
                <Stack spacing={2} className="mt-8">
                    <Typography level="body2" secondary>
                        Zadnja izmjena: 11. Studeni 2024.
                    </Typography>
                    <Typography level="body2" secondary>
                        Ova politika je u skladu sa zakonodavstvom o zaštiti
                        podataka, uključujući GDPR i druge relevantne
                        regulative.
                    </Typography>
                </Stack>
            </Stack>
        </Container>
    );
}
