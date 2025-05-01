import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { Row } from "@signalco/ui-primitives/Row";
import { getEntityTypeByName } from "@gredice/storage";
import { EntitiesTable } from "./EntitiesTable";
import { createEntity } from "../../../(actions)/entityActions";
import { Add } from "@signalco/ui-icons";
import { ServerActionIconButton } from "../../../../components/shared/ServerActionIconButton";
import Link from "next/link";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { BookA } from "lucide-react";
import { KnownPages } from "../../../../src/KnownPages";
import { auth } from "../../../../lib/auth/auth";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Stack } from "@signalco/ui-primitives/Stack";

export const dynamic = 'force-dynamic';

export default async function EntitiesPage({ params }: { params: Promise<{ entityType: string }> }) {
    await auth(['admin']);
    const { entityType: entityTypeName } = await params;
    const entityType = await getEntityTypeByName(entityTypeName);
    const createEntityBound = createEntity.bind(null, entityTypeName);

    return (
        <Stack spacing={2}>
            <Row spacing={1} justifyContent="space-between">
                <Typography level="h1" className="text-2xl" semiBold>{entityType?.label}</Typography>
                <Row>
                    <Link href={KnownPages.DirectoryEntityTypeAttributeDefinitions(entityTypeName)}>
                        <IconButton variant="plain" title="Atributi">
                            <BookA className='size-5' />
                        </IconButton>
                    </Link>
                    <ServerActionIconButton
                        variant="plain"
                        title="Dodaj zapis"
                        onClick={createEntityBound}>
                        <Add className='size-5' />
                    </ServerActionIconButton>
                </Row>
            </Row>
            <Card>
                <CardOverflow>
                    <EntitiesTable entityTypeName={entityTypeName} />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
