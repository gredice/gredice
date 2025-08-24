import { Container } from '@signalco/ui-primitives/Container';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { Metadata } from 'next';
import { PageHeader } from '../../../components/shared/PageHeader';
import { StyledHtml } from '../../../components/shared/StyledHtml';

export const metadata: Metadata = {
    title: 'Tvrtka',
    description: 'Službeni podaci o društvu Gredice d.o.o.',
};

export default function UvjetiKoristenjaPage() {
    return (
        <Container maxWidth="sm">
            <Stack>
                <PageHeader
                    padded
                    header="Tvrtka"
                    subHeader="Službeni podaci o društvu Gredice d.o.o."
                />
                <StyledHtml>
                    <h2>Podaci o društvu</h2>
                    <p>
                        <strong>Gredice d.o.o.</strong>
                        <br />
                        <small>
                            Gredice društvo s ograničenom odgovornošću za
                            proizvodnju, trgovinu i usluge
                        </small>
                        <br />
                        OIB: <span>86171547809</span>
                        <br />
                        Ulica Julija Knifera 3,
                        <br />
                        Zagreb (Grad Zagreb)
                    </p>

                    <h3>Nadležni sud</h3>
                    <p>
                        Trgovački sud u Zagrebu, pod brojem: Tt-25/2168-2
                        (23.01.2025.)
                        <br />
                        MBS: <span>081628528</span>
                        <br />
                        EUID: <span>HRSR.081628528</span>
                        <br />
                        Temeljni kapital u iznosu od 2.500,00€ je uplaćen u
                        cijelosti.
                        <br />
                        <a href="https://sudreg.pravosudje.hr/registar/f?p=150:28:0::NO:28:P28_SBT_MBS:081628528">
                            Sudski registar - Podaci o poslovnom subjektu
                        </a>
                    </p>

                    <h3>Poslovni računi</h3>
                    <p>
                        Privredna banka Zagreb d.d., Radnička cesta 50, 10000
                        Zagreb, Hrvatska
                        <br />
                        IBAN: <span>HR5223400091111312385</span>
                        <br />
                        <small>
                            Molimo vas da ne uplaćujete na gore navedeni račun
                            bez prethodne najave i dogovora s našim prodajnim
                            timom. Ovaj podatak je ovdje isključivo u zakonske
                            svrhe.
                        </small>
                    </p>

                    <h3>Članovi uprave</h3>
                    <p>Toplek, Aleksandar</p>

                    <h3>Adresa elektroničke pošte</h3>
                    <p>
                        <a href="mailto:kontakt@gredice.com">
                            kontakt@gredice.com
                        </a>
                    </p>

                    <p>
                        <small>
                            Informacije navedene prema članku 21. Zakona o
                            trgovačkim društvima Republike Hrvatske
                        </small>
                    </p>
                </StyledHtml>
                <Typography level="body2" secondary className="mt-8">
                    Zadnja izmjena: 28. Veljača 2025.
                </Typography>
            </Stack>
        </Container>
    );
}
