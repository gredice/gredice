import { Typography } from "@signalco/ui-primitives/Typography";
import { ServerActionButton } from "../../../../components/shared/ServerActionButton";
import { createEntity } from "../../../(actions)/entityActions";
import { Add } from "@signalco/ui-icons";
import { Stack } from "@signalco/ui-primitives/Stack";

export const dynamic = 'force-dynamic';

export default async function EntitiesPage({ entityTypeName }: { entityTypeName: string }) {
    return (
        <Stack spacing={2} className="py-8" alignItems="center">
            <Typography level="body2" center>Odaberite zapis ili kreirajte novi.</Typography>
            <ServerActionButton
                variant="solid"
                title="Dodaj zapis"
                actionProps={[entityTypeName]}
                onClick={createEntity}
                startDecorator={<Add className="size-5" />}>
                Dodaj zapis
            </ServerActionButton>
        </Stack>
    );
}
