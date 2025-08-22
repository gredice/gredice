import { Stack } from "@signalco/ui-primitives/Stack";
import { PageHeader } from "../../components/shared/PageHeader";
import { Container } from "@signalco/ui-primitives/Container";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Legalno",
    description: "Pravni dokumenti i informacije"
}

export default function LegalnoPage() {
    return (
        <Container maxWidth="sm">
            <Stack className="pb-24" spacing={1}>
                <PageHeader padded header="Legalno" />
                <Typography>Ovdje se nalaze svi dokumenti koji ti mogu biti korisni.</Typography>
                <Typography>Odaberi jedan od lijevo navedenih dokumenata za više detalja.</Typography>
            </Stack>
        </Container>
    );
}