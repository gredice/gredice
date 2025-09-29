import { Container } from '@signalco/ui-primitives/Container';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { Metadata } from 'next';
import { PageHeader } from '../../../components/shared/PageHeader';
import { StyledHtml } from '../../../components/shared/StyledHtml';

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
                        na vašem uređaju prilikom posjeta našoj web stranici.
                        Oni omogućuju web stranici da prepozna vaš uređaj i
                        prikupi informacije o vašem posjetu.
                    </p>
                    <h2>Kolačići koje koristimo</h2>
                    <p>
                        Naša web stranica koristi isključivo nužne kolačiće. Ovi
                        kolačići su bitni za ispravno funkcioniranje web
                        stranice i ne mogu se isključiti u našim sustavima.
                        Obično se postavljaju samo kao odgovor na radnje koje
                        ste poduzeli, kao što su postavljanje vaših postavki
                        privatnosti, prijava ili dovršavanje obrazaca.
                    </p>
                    <p>Primjeri nužnih kolačića uključuju:</p>
                    <ul>
                        <li>
                            <strong>Kolačići za autentikaciju</strong>: Ovi
                            kolačići omogućuju vam pristup sigurnim dijelovima
                            naše web stranice.
                        </li>
                        <li>
                            <strong>Kolačići za sesiju</strong>: Ovi kolačići
                            pomažu u omogućavanju funkcionalnosti kao što su
                            navigacija između stranica i vraćanje na prethodne
                            stranice.
                        </li>
                    </ul>
                    <h2>Kako možete upravljati kolačićima</h2>
                    <p>
                        Većina web preglednika automatski prihvaća kolačiće, ali
                        vi možete odabrati hoćete li ih prihvatiti ili ne. Ako
                        ne želite primati kolačiće, možete postaviti svoje
                        preglednike da ih odbijaju ili vas upozore kada se
                        kolačići šalju.
                    </p>
                    <p>
                        Imajte na umu da, ako onemogućite kolačiće, neke
                        dijelove naše web stranice možda neće pravilno
                        funkcionirati.
                    </p>
                    <h2>Prava korisnika</h2>
                    <p>
                        Imate pravo znati koje informacije prikupljamo putem
                        kolačića i za što se koriste. Također imate pravo
                        zatražiti brisanje ili ispravak informacija koje smo
                        prikupili.
                    </p>
                    <h2>Kontakt informacije</h2>
                    <p>
                        Ako imate bilo kakva pitanja ili trebate više
                        informacija o našoj politici kolačića, slobodno nas
                        kontaktirajte putem adrese e-pošte na{' '}
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
                <Stack spacing={1} className="mt-8">
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
