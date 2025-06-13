import { Stack } from "@signalco/ui-primitives/Stack";
import { PageHeader } from "../../components/shared/PageHeader";
import { StyledHtml } from "../../components/shared/StyledHtml";
import { Row } from "@signalco/ui-primitives/Row";
import { Typography } from "@signalco/ui-primitives/Typography";
import { FeedbackModal } from "../../components/shared/feedback/FeedbackModal";

export default function RaisedBedPage() {
    return (
        <Stack>
            <PageHeader header="Podignuta gredica" padded />
            <StyledHtml>
                <p>Podignuta gredica je idealno rješenje za uzgoj povrća i cvijeća u vrtu. Ova metoda omogućava bolju drenažu, kontrolu tla i lakše održavanje.</p>
                <p>U nastavku možete pronaći više informacija o podignutim gredicama, uključujući njihove prednosti, materijale i savjete za izradu.</p>
            </StyledHtml>
            <Row spacing={2} className="mt-12">
                <Typography level="body1">Jesu li ti informacije o podignutim gredicama korisne?</Typography>
                <FeedbackModal topic="www/raised-beds" />
            </Row>
        </Stack>
    );
}