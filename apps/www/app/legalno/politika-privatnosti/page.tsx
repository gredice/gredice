import { Stack } from "@signalco/ui-primitives/Stack";
import { PageHeader } from "../../../components/shared/PageHeader";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Container } from "@signalco/ui-primitives/Container";

export default function PolitikaPrivatnostiPage() {
    return (
        <Container maxWidth="sm">
            <Stack spacing={4}>
                <PageHeader padded header="Politika Privatnosti" />
                <div className="prose">
                    <h2>Uvod</h2>
                    <p>
                        Dobrodošli na Gredice! Naša web stranica (<a href="https://www.gredice.com">www.gredice.com</a>) pruža usluge upravljanja i dostave povrća i vrtnih proizvoda. Vaša privatnost nam je važna, stoga smo izradili ovu Politiku privatnosti kako bismo vam objasnili kako prikupljamo, koristimo i štitimo vaše osobne podatke.
                    </p>
                    <h2>Prikupljanje Podataka</h2>
                    <p>
                        Prilikom korištenja naše web stranice možemo prikupljati sljedeće vrste osobnih podataka:
                    </p>
                    <ul>
                        <li><strong>Osnovni kontaktni podaci</strong>: ime, adresa e-pošte, telefonski broj.</li>
                        <li><strong>Podaci o narudžbama</strong>: informacije vezane uz vaše narudžbe, uključujući isporuku i odabrane proizvode.</li>
                        <li><strong>Podaci o korištenju</strong>: informacije prikupljene putem alata za analitiku (Vercel Analytics) koje nam pomažu da razumijemo kako koristite našu web stranicu.</li>
                    </ul>
                    <p>Svi podaci prikupljaju se s vašim pristankom ili na temelju zakonskih obveza.</p>
                    <h2>Korištenje Podataka</h2>
                    <p>
                        Vaše osobne podatke koristimo u sljedeće svrhe:
                    </p>
                    <ul>
                        <li><strong>Obrada narudžbi</strong>: kako bismo ispunili vašu narudžbu i osigurali kvalitetnu uslugu.</li>
                        <li><strong>Komunikacija:</strong> za slanje obavijesti o vašim narudžbama, sustavnih e-poruka i za odgovaranje na vaše upite.</li>
                        <li><strong>Poboljšanje usluga</strong>: analizom podataka možemo unaprijediti našu ponudu i web stranicu.</li>
                    </ul>
                    <p>Ne šaljemo marketinške ili informativne newslettere bez vašeg pristanka.</p>
                    <h2>Mjere Zaštite</h2>
                    <p>
                        Razumijemo važnost zaštite vaših osobnih podataka. Poduzeli smo sve moguće mjere zaštite, uključujući:
                    </p>
                    <ul>
                        <li><strong>Tehničke mjere</strong>: korištenje sigurnih poslužitelja i enkripcije podataka kako bismo zaštitili vaše informacije.</li>
                        <li><strong>Organizacijske mjere</strong>: ograničavanje pristupa osobnim podacima samo na ovlaštene zaposlenike koji ih trebaju za obradu.</li>
                    </ul>
                    <h2>Prava Korisnika</h2>
                    <p>
                        Kao korisnik naše web stranice imate prava koja uključuju:
                    </p>
                    <ul>
                        <li><strong>Pravo na pristup</strong>: možete zatražiti kopiju svojih osobnih podataka.</li>
                        <li><strong>Pravo na ispravak</strong>: imate pravo ispraviti svoje osobne podatke ako su netočni ili nepotpuni.</li>
                        <li><strong>Pravo na brisanje</strong>: možete tražiti brisanje svojih osobnih podataka pod određenim uvjetima.</li>
                        <li><strong>Pravo na pritužbu</strong>: imate pravo podnijeti pritužbu nadležnom tijelu ako smatrate da su vaši podaci korišteni protivno zakonu.</li>
                    </ul>
                    <h2>Treće Strane</h2>
                    <p>
                        Možemo dijeliti vaše osobne podatke s trećim stranama isključivo u svrhu opskrbe naših usluga, uključujući pružatelje usluga dostave i analitičke alate. Uvijek ćemo se pobrinuti da te treće strane poštuju vašu privatnost u skladu s ovom politikom.
                    </p>
                    <h2>Promjene Politike</h2>
                    <p>
                        Ova Politika privatnosti može se povremeno ažurirati. Sve promjene objavit ćemo na ovoj stranici, a datumi kada je politika posljednji put ažurirana bit će navedeni na dnu dokumenta.
                    </p>
                    <h2>Kontakt</h2>
                    <p>
                        Ako imate bilo kakva pitanja ili brige u vezi s ovom politikom privatnosti, slobodno nas kontaktirajte putem e-pošte na <a href="mailto:kontakt@gredice.com">kontakt@gredice.com</a>.
                    </p>
                    <p>
                        Zahvaljujemo vam na povjerenju i što koristite Gredice!
                    </p>
                </div>
                <Typography level="body2" secondary>
                    Zadnja izmjena: 2. Studeni 2024.
                </Typography>
            </Stack>
        </Container>
    );
}