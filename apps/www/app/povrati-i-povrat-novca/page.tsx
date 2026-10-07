import { Container } from '@gredice/ui/Container';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import { StyledHtml } from '@gredice/ui/StyledHtml';
import { RelatedFaq } from '../../components/faq/RelatedFaq';
import { createPublicMetadata } from '../../lib/seo/publicMetadata';
import { KnownPages } from '../../src/KnownPages';

export const metadata = createPublicMetadata({
    title: 'Povrat novca',
    description:
        'Puni povrat sadnje u suncokretima za biljke koje nisu proklijale nakon 15 dana te pravila ostalih povrata i korekcija salda.',
    path: KnownPages.Refunds,
    eyebrow: 'Povrati',
});

export default function RefundsPage() {
    return (
        <Container maxWidth="md">
            <Stack>
                <PageHeader
                    padded
                    header="Povrat novca"
                    subHeader="Za biljku koja nije proklijala nakon 15 dana vraćamo puni plaćeni iznos sadnje u suncokretima. Ostale reklamacije možeš zatražiti unutar 30 dana od kupnje."
                />
                <StyledHtml>
                    <h2>Puni povrat za biljku koja nije proklijala</h2>
                    <p>{notSproutedRefundPolicy}</p>
                    <p>
                        Povrat dobivaš automatski u suncokretima, bez zahtjeva
                        podršci. Obavijest u vrtu potvrđuje iznos povrata.
                    </p>
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
                    <h2>Suncokreti i Gredice saldo</h2>
                    <p>
                        Suncokreti su prepaid Gredice bodovi koji se koriste
                        samo unutar Gredica za vrtne akcije i povezane usluge.
                        Ne prenose se na druge korisnike i ne mogu se zamijeniti
                        za gotovinu osim kada je povrat zakonski obvezan ili ga
                        Gredice izričito odobre.
                    </p>
                    <p>
                        Kada naručiš akciju u vrtu, potreban broj suncokreta
                        oduzima se sa salda odmah pri potvrdi narudžbe. Ako se
                        akcija otkaže prije obrade, suncokreti se vraćaju na
                        saldo kao povrat.
                    </p>
                    <p>
                        Za ostale izvršene akcije povrat ili korekcija rješava
                        se kroz korisničku podršku. Bonus suncokreti iz paketa
                        ne predstavljaju zaseban novčani iznos i ne obećavaju
                        automatski gotovinski povrat.
                    </p>
                    <h2>Kako zatražiti povrat</h2>
                    <p>
                        Javi se našoj podršci i opiši razlog nezadovoljstva.
                        Nakon provjere zahtjeva predložit ćemo puni povrat novca
                        ili korekciju Gredice salda.
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
                        Ostale zahtjeve za povrat provjerava i odobrava
                        korisnička podrška.
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
            <RelatedFaq placement="refunds" />
        </Container>
    );
}

import { notSproutedRefundPolicy } from '@gredice/js/plants';
