import { Stack } from "@signalco/ui-primitives/Stack";
import { PageHeader } from "../../../components/shared/PageHeader";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Container } from "@signalco/ui-primitives/Container";

export default function PolitikaPrivatnostiPage() {
    return (
        <Container maxWidth="sm">
            <Stack spacing={4}>
                <PageHeader
                    padded
                    header="Licenca izvornog koda"
                    subHeader="Ova licenca objašnjava uvjete korištenja izvornog koda aplikacije Gredice."
                />
                <div className="prose">
                    <p>Izvorni kod aplikacije Gredice dostupan je pod licencom <a href="https://github.com/gredice/gredice/blob/main/LICENSE">AGPL-3.0</a>. To znači da možete pregledati, preuzeti, mijenjati i distribuirati izvorni kod aplikacije pod uvjetima ove licence.</p>
                    <p>Izvorni kod dostupan je na <a href="https://github.com/gredice/gredice">GitHub</a> repozitoriju.</p>
                    <p>Ukoliko imate bilo kakvih pitanja o licenci ili korištenju izvornog koda, slobodno nas kontaktirajte na <a href="mailto:kontakt@gredice.com">kontakt@gredice.com</a>.</p>
                </div>
                <Typography level="body2" secondary>
                    Zadnja izmjena: 20. Studeni 2024.
                </Typography>
            </Stack>
        </Container>
    );
}