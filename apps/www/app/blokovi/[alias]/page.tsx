import { notFound } from "next/navigation";
import { entities } from "../../../../../packages/game/src/data/entities";
import { PageHeader } from "../../../components/shared/PageHeader";
import { Stack } from "@signalco/ui-primitives/Stack";
import { EntityViewer } from "@gredice/game";
import { List, ListHeader } from "@signalco/ui-primitives/List";
import { ListItem } from "@signalco/ui-primitives/ListItem";
import { KnownPages } from "../../../src/KnownPages";
import { SplitView } from "@signalco/ui/SplitView";

export default async function BlockPage({ params }: { params: Promise<{ alias: string }> }) {
    const { alias } = await params;
    const entityKey = (Object.keys(entities) as Array<keyof typeof entities>).find((entityKey) => entities[entityKey].alias === alias);
    const entity = entityKey ? entities[entityKey] : null;
    if (!entity) {
        notFound();
    }

    return (
        <div className="border-b">
            <SplitView>
                <Stack spacing={1} className="p-4">
                    <ListHeader header="Blokovi" />
                    <List>
                        {(Object.keys(entities) as Array<keyof typeof entities>).map((entityKey) => {
                            const entity = entities[entityKey];
                            return (
                                <ListItem
                                    key={entity.name}
                                    label={entity.alias}
                                    href={KnownPages.Block(entity.alias)} />
                            );
                        })}
                    </List>
                </Stack>
                <Stack spacing={4} className="p-4">
                    <PageHeader
                        visual={(
                            <EntityViewer
                                entityName={entity.name}
                                appBaseUrl="https://vrt.gredice.com" />
                        )}
                        header={entity.alias}
                        subHeader={entity.description}
                    />
                </Stack>
            </SplitView>
        </div>
    )
}