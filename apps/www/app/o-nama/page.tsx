import { Stack } from "@signalco/ui-primitives/Stack";
import { PageHeader } from "../../components/shared/PageHeader";

export default function AboutUsPage() {
    return (
        <Stack>
            <PageHeader
                header="O nama"
                subHeader="Sve što te može zanimati o nama i našem radu."
                padded />
        </Stack>
    );
}