import { StyledHtml } from '@gredice/ui/StyledHtml';
import { Container } from '@signalco/ui-primitives/Container';
import { Stack } from '@signalco/ui-primitives/Stack';
import type { Metadata } from 'next';
import { PageHeader } from '../../components/shared/PageHeader';
import { KnownPages } from '../../src/KnownPages';

export const metadata: Metadata = {
    title: 'Povrat novca',
    description:
        'Informacije o 30-dnevnoj politici povrata novca za biljke, sorte i radnje na tržištu Hrvatske.',
};

export default function RefundsPage() {
    return (
        <Container maxWidth="md">
            <Stack>
                <PageHeader
                    padded
                    header="Povrat novca"
                    subHeader="Ako nisi zadovoljan uslugom ili proizvodom, možeš zatražiti povrat novca u roku od 30 dana."
                />
                <StyledHtml>
                    <h2>Naša politika</h2>
                    <p>
                        Reklamacije su moguće za biljke i radnje unutar{' '}
                        <strong>30 dana</strong> od trenutka kupovine.
                    </p>
                    <p>
                        Kako se radi o uslugama i digitalno vođenim procesima,
                        klasičan fizički povrat robe nije primjenjiv. Umjesto
                        povrata robe, odobravamo:
                    </p>
                    <ul>
                        <li>puni povrat novca, ili</li>
                        <li>
                            kredit u obliku suncokreta na korisničkom računu,
                            prema dogovoru sa podrškom.
                        </li>
                    </ul>
                    <h2>Kako zatražiti povrat</h2>
                    <p>
                        Javi se našoj podršci i opiši razlog nezadovoljstva.
                        Nakon provjere zahtjeva predložit ćemo puni povrat novca
                        ili suncokreta.
                    </p>
                    <p>
                        Kontakt stranicu možeš otvoriti ovdje:{' '}
                        <a href={KnownPages.Contact}>Kontakt</a>.
                    </p>
                    <h2>Važno</h2>
                    <p>
                        Trenutno je ova politika dostupna samo za narudžbe na
                        tržištu Hrvatske (HR).
                    </p>
                    <p>
                        Povrat je moguć isključivo kroz korisničku podršku i
                        odobrenje povrata novca/suncokreta.
                    </p>
                    <hr />
                    <p>
                        <small>
                            Cijene i povezane informacije možeš provjeriti na
                            stranici <a href={KnownPages.Pricing}>Cjenik</a>.
                        </small>
                    </p>
                </StyledHtml>
            </Stack>
        </Container>
    );
}
