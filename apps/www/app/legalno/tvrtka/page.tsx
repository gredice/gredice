import { Container } from '@gredice/ui/Container';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import { StyledHtml } from '@gredice/ui/StyledHtml';
import { Typography } from '@gredice/ui/Typography';
import { createPublicMetadata } from '../../../lib/seo/publicMetadata';
import { KnownPages } from '../../../src/KnownPages';

export const metadata = createPublicMetadata({
    title: 'Tvrtka',
    description: 'Službeni podaci o društvu Gredice d.o.o.',
    path: KnownPages.LegalCompany,
    eyebrow: 'Pravni dokument',
});

export default function CompanyPage() {
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
                        10000 Zagreb, Hrvatska
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
                        <a href="https://sudreg.pravosudje.hr/ords/r/esudreg/public/podaci-o-poslovnom-subjektu?p28_sbt_mbs=081628528">
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
                            Molimo te da ne uplaćuješ na gore navedeni račun bez
                            prethodne najave i dogovora s našim prodajnim timom.
                            Ovaj podatak je ovdje isključivo u zakonske svrhe.
                        </small>
                    </p>

                    <h3>Članovi uprave</h3>
                    <p>Toplek, Aleksandar</p>

                    <h3>Kontakt i pisani prigovori</h3>
                    <p>
                        <a href="mailto:kontakt@gredice.com">
                            kontakt@gredice.com
                        </a>
                        <br />
                        Telefon:{' '}
                        <a href="tel:+385993447418">+385 99 344 7418</a>
                    </p>
                    <p>
                        Pisani prigovor možeš poslati na navedenu adresu e-pošte
                        ili poštansku adresu društva te ga predati u poslovnim
                        prostorijama. Primitak potvrđujemo bez odgađanja, a
                        pisani odgovor dostavljamo u roku od 15 dana od
                        primitka. Pojedinosti su na stranici{' '}
                        <a href={KnownPages.Contact}>Kontakt</a>.
                    </p>
                    <p>
                        Pravila naručivanja i prava potrošača opisana su na
                        stranicama{' '}
                        <a href={KnownPages.LegalTerms}>Uvjeti korištenja</a> i{' '}
                        <a href={KnownPages.Refunds}>Povrat novca</a>.
                    </p>

                    <p>
                        <small>
                            Informacije navedene prema članku 21. Zakona o
                            trgovačkim društvima Republike Hrvatske
                        </small>
                    </p>
                </StyledHtml>
                <Typography level="body2" secondary className="mt-8">
                    Zadnja izmjena: 22. rujna 2026.
                </Typography>
            </Stack>
        </Container>
    );
}
