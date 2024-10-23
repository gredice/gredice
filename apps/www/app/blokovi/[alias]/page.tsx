import { notFound } from "next/navigation";
import { entities } from "../../../../../packages/game/src/data/entities";
import { PageHeader } from "../../../components/shared/PageHeader";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { EntityViewer } from "@gredice/game";

export default async function BlockPage({ params }: { params: Promise<{ alias: string }> }) {
    const { alias } = await params;
    const entityKey = (Object.keys(entities) as Array<keyof typeof entities>).find((entityKey) => entities[entityKey].alias === alias);
    const entity = entityKey ? entities[entityKey] : null;
    if (!entity) {
        notFound();
    }

    return (
        <Stack>
            <PageHeader header={entity.alias} subHeader={""} />
            <Card className="overflow-hidden size-56 relative">
                <CardOverflow className="h-full">
                    <EntityViewer
                        entityName={entity.name}
                        appBaseUrl="https://vrt.gredice.com" />
                </CardOverflow>
            </Card>
        </Stack>
    )
}