import { StyledHtml } from '@gredice/ui/StyledHtml';
import { Container } from '@signalco/ui-primitives/Container';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { Metadata } from 'next';
import { PageHeader } from '../../components/shared/PageHeader';

export const metadata: Metadata = {
    title: 'Pravila natječaja Advent 2025',
    description:
        'Pročitaj službena pravila za sudjelovanje u Gredice Adventskom kalendaru 2025.',
};

export default function AdventRules2025Page() {
    return (
        <Container maxWidth="sm">
            <Stack>
                <PageHeader
                    padded
                    header="Pravila natječaja Advent 2025"
                    subHeader="Saznaj kako sudjelovati, osvojiti nagrade i koje su obveze organizatora Adventskog kalendara."
                />

                <StyledHtml>
                    <p>
                        Ova pravila natječaja (dalje u tekstu: Pravila) odnose se na
                        promotivni nagradni natječaj „Gredice Adventski kalendar
                        2025.“ (dalje u tekstu: Natječaj) koji organizira Gredice
                        d.o.o. (dalje u tekstu: Organizator). Sudjelovanjem u
                        Natječaju prihvaćaš ova Pravila u cijelosti.
                    </p>

                    <h2>1. Organizator</h2>
                    <p>
                        Organizator Natječaja je Gredice d.o.o., OIB 54129034946,
                        sa sjedištem na adresi Ivana Bošnjaka 4, 10410 Velika
                        Gorica. Za sva pitanja u vezi Natječaja možeš nas
                        kontaktirati putem <a href="mailto:info@gredice.com">info@gredice.com</a>.
                    </p>

                    <h2>2. Trajanje i područje provedbe</h2>
                    <p>
                        Natječaj traje od 1. prosinca 2025. u 00:00 do 24. prosinca
                        2025. u 23:59 i provodi se na području Republike Hrvatske
                        putem aplikacije i web stranice Gredice.
                    </p>

                    <h2>3. Pravo sudjelovanja</h2>
                    <ul>
                        <li>
                            U Natječaju mogu sudjelovati sve fizičke osobe s
                            prebivalištem ili boravištem u Republici Hrvatskoj koje
                            su registrirale korisnički račun u aplikaciji Gredice.
                        </li>
                        <li>
                            U Natječaju ne mogu sudjelovati zaposlenici
                            Organizatora, povezane društvo ni članovi njihovih
                            užih obitelji.
                        </li>
                    </ul>

                    <h2>4. Način sudjelovanja</h2>
                    <ul>
                        <li>
                            Sudjeluješ tako što tijekom trajanja Natječaja otvaraš
                            adventska polja u aplikaciji Gredice.
                        </li>
                        <li>
                            Za valjano sudjelovanje moraš imati aktivan korisnički
                            račun te koristiti najnoviju verziju aplikacije.
                        </li>
                        <li>
                            Svaki dan može se otvoriti jedno adventsko polje.
                        </li>
                    </ul>

                    <h2>5. Nagrade</h2>
                    <ul>
                        <li>
                            Nagrade su digitalni i/ili fizički pokloni koji mogu
                            uključivati virtualne predmete, popuste ili fizičke
                            proizvode navedene u opisu adventskog polja.
                        </li>
                        <li>
                            Nagrade nisu zamjenjive za novac niti je moguće tražiti
                            isplatu njihove novčane protuvrijednosti.
                        </li>
                    </ul>

                    <h2>6. Odabir i objava dobitnika</h2>
                    <ul>
                        <li>
                            Dobitnici se određuju automatski otvaranjem adventskog
                            polja u skladu s opisom nagrade navedenim za taj dan.
                        </li>
                        <li>
                            Dobitnici fizičkih nagrada bit će obaviješteni putem
                            e-pošte i/ili obavijesti u aplikaciji u roku od 5 dana
                            od otvaranja polja.
                        </li>
                    </ul>

                    <h2>7. Preuzimanje nagrada</h2>
                    <ul>
                        <li>
                            Virtualne nagrade dodjeljuju se izravno na korisnički
                            račun nakon otvaranja polja.
                        </li>
                        <li>
                            Fizičke nagrade dostavljaju se prema uputama koje
                            Organizator dostavlja dobitniku. Ako dobitnik u roku od
                            7 dana ne potvrdi podatke za dostavu, smatrat će se da
                            je odustao od nagrade.
                        </li>
                    </ul>

                    <h2>8. Porezi i troškovi</h2>
                    <p>
                        Organizator snosi poreze i eventualne obvezne doprinose
                        koji se primjenjuju na nagrade, osim ako zakonom nije
                        drukčije propisano.
                    </p>

                    <h2>9. Diskvalifikacija</h2>
                    <p>
                        Organizator zadržava pravo diskvalificirati sudionike koji
                        pokušaju zloupotrebljavati mehaniku Natječaja, sudjeluju s
                        lažnim profilima ili krše ova Pravila.
                    </p>

                    <h2>10. Obrada osobnih podataka</h2>
                    <p>
                        Osobni podaci prikupljaju se i obrađuju isključivo radi
                        provedbe Natječaja, kontaktiranja dobitnika i dostave
                        nagrada, u skladu s Politikom privatnosti Gredica.
                        Sudionici imaju pravo na pristup, ispravak, ograničenje
                        obrade i ostala prava propisana važećim propisima.
                    </p>

                    <h2>11. Pravo izmjene pravila</h2>
                    <p>
                        Organizator zadržava pravo izmjene ili dopune ovih Pravila
                        ako to zahtijevaju opravdani razlozi, uz objavu izmjena na
                        <a href="https://www.gredice.com/advent-2025/pravila-natjecaja">ovoj stranici</a>.
                    </p>

                    <h2>12. Rješavanje pritužbi</h2>
                    <p>
                        Sve pritužbe vezane uz provedbu Natječaja sudionici mogu
                        poslati na <a href="mailto:info@gredice.com">info@gredice.com</a>.
                        Organizator će odgovoriti u roku od 15 dana od zaprimanja
                        pritužbe.
                    </p>

                    <h2>13. Završne odredbe</h2>
                    <p>
                        Ova Pravila stupaju na snagu danom objave. Sudjelovanjem u
                        Natječaju potvrđuješ da si pročitao/la, razumio/la i
                        prihvatio/la sva Pravila.
                    </p>

                    <Typography level="body3" className="text-neutral-600">
                        Posljednja izmjena: 1. listopada 2025.
                    </Typography>
                </StyledHtml>
            </Stack>
        </Container>
    );
}
