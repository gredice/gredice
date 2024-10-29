import { Typography } from "@signalco/ui-primitives/Typography";
import { createEntity } from "../../../(actions)/entityActions";
import { Add } from "@signalco/ui-icons";
import { Stack } from "@signalco/ui-primitives/Stack";
import { ServerActionButton } from "../../../../components/shared/ServerActionButton";

export const dynamic = 'force-dynamic';

export default async function EntitiesPage({ params }: { params: Promise<{ entityType: string }> }) {
    const { entityType: entityTypeName } = await params;
    const createEntityBound = createEntity.bind(null, entityTypeName);

    return (
        <Stack spacing={2} className="py-8" alignItems="center">
            <Typography level="body2" center>Odaberite zapis ili kreirajte novi.</Typography>
            <ServerActionButton
                variant="solid"
                title="Dodaj zapis"
                onClick={createEntityBound}
                startDecorator={<Add className="size-5" />}>
                Dodaj zapis
            </ServerActionButton>
        </Stack>
    );
}
