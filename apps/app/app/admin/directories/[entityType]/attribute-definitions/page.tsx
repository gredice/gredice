import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { CreateAttributeDefinitionButton } from "./CreateAttributeDefinitionButton";
import { CreateAttributeDefinitionCategoryButton } from "./CreateAttributeDefinitionCategoryButton";
import { Divider } from "@signalco/ui-primitives/Divider";

export const dynamic = 'force-dynamic';

export default async function AttributesPage({ params }: { params: Promise<{ entityType: string }> }) {
    const { entityType } = await params;
    return (
        <Stack spacing={2} alignItems="center" className="py-8">
            <Typography level="body2" center>
                Odaberite atribut iz liste ili kreirajte novi.
            </Typography>
            <Stack spacing={2} className="max-w-40">
                <CreateAttributeDefinitionButton entityTypeName={entityType} />
                <Divider className="max-w-8 self-center" />
                <CreateAttributeDefinitionCategoryButton entityTypeName={entityType} />
            </Stack>
        </Stack>
    );
}