import { Stack } from "@signalco/ui-primitives/Stack";
import { PageHeader } from "../../../components/shared/PageHeader";
import { Container } from "@signalco/ui-primitives/Container";

export default function PolitikaKolacicaPage() {
    return (
        <Container maxWidth="sm">
            <Stack spacing={4}>
                <PageHeader padded header="Politika Kolačića" />
            </Stack>
        </Container>
    );
}