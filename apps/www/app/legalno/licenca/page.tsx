import { Container } from '@gredice/ui/Container';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import { StyledHtml } from '@gredice/ui/StyledHtml';
import { Typography } from '@gredice/ui/Typography';
import { createPublicMetadata } from '../../../lib/seo/publicMetadata';
import { KnownPages } from '../../../src/KnownPages';

export const metadata = createPublicMetadata({
    title: 'Licenca izvornog koda',
    description:
        'AGPL-3.0 licenca izvornog koda Gredica i odnos prema drugim materijalima i pravima.',
    path: KnownPages.LegalLicense,
    eyebrow: 'Pravni dokument',
});

export default function SourceCodeLicensePage() {
    return (
        <Container maxWidth="sm">
            <Stack>
                <PageHeader
                    padded
                    header="Licenca izvornog koda"
                    subHeader="AGPL-3.0 licenca izvornog koda Gredica i odnos prema drugim materijalima i pravima."
                />
                <StyledHtml>
                    <h2>Izvorni kod Gredica</h2>
                    <p>
                        Izvorni kod aplikacije Gredice objavljen je u{' '}
                        <a href="https://github.com/gredice/gredice">
                            GitHub repozitoriju
                        </a>{' '}
                        pod licencom{' '}
                        <a href="https://github.com/gredice/gredice/blob/main/LICENSE">
                            GNU Affero General Public License, verzija 3
                            (AGPL-3.0)
                        </a>
                        . Mjerodavan je puni tekst licence i obavijesti koje
                        prate pojedini dio repozitorija.
                    </p>
                    <p>
                        Licenca dopušta korištenje, proučavanje, izmjenu i
                        distribuciju koda uz ispunjavanje njezinih uvjeta. Oni
                        uključuju očuvanje relevantnih obavijesti i dostupnost
                        odgovarajućeg izvornog koda u slučajevima propisanima
                        licencom.
                    </p>
                    <h2>Izmjene i rad preko mreže</h2>
                    <p>
                        AGPL sadrži i obvezu za izmijenjenu verziju s kojom
                        korisnici komuniciraju preko računalne mreže: takvim
                        korisnicima treba ponuditi pristup odgovarajućem
                        izvornom kodu te verzije u skladu s člankom 13. licence.
                        Ovaj sažetak ne zamjenjuje puni tekst niti mijenja
                        njegov opseg.
                    </p>
                    <h2>Drugi materijali i oznake</h2>
                    <p>
                        Za dijelove s posebno navedenom licencom vrijedi ta
                        licenca. Provjeri prateće obavijesti za ovisnosti,
                        fotografije, ilustracije, modele i druge materijale
                        prije njihove ponovne uporabe. Ova stranica ne uvodi
                        novu iznimku za materijal koji je već licenciran AGPL-om
                        niti oduzima prava dana primjenjivom licencom.
                    </p>
                    <p>
                        Objava izvornog koda ne daje sama po sebi dopuštenje da
                        svoj proizvod predstavljaš kao službenu uslugu Gredice
                        ili da koristiš tuđe zaštićene oznake izvan zakonom
                        dopuštenog opsega.
                    </p>
                    <h2>Licenca koda i korištenje usluge</h2>
                    <p>
                        Prava na kod razlikuju se od prava i obveza pri
                        naručivanju usluge Gredice. Za uslugu vrijede{' '}
                        <a href={KnownPages.LegalTerms}>Uvjeti korištenja</a> i
                        obvezna prava korisnika; ti uvjeti ne ograničavaju prava
                        koja daje licenca koda. Odredbe licence o jamstvu za
                        softver ne zamjenjuju zakonsku odgovornost za naplaćene
                        proizvode i usluge.
                    </p>
                    <p>
                        Za pitanja piši na{' '}
                        <a href="mailto:kontakt@gredice.com">
                            kontakt@gredice.com
                        </a>
                        .
                    </p>
                </StyledHtml>
                <Typography level="body2" secondary className="mt-8">
                    Zadnja izmjena: 22. rujna 2026.
                </Typography>
            </Stack>
        </Container>
    );
}
