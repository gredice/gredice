import { notFound } from "next/navigation";
import { PageHeader } from "../../../components/shared/PageHeader";
import { Stack } from "@signalco/ui-primitives/Stack";
import { EntityViewer } from "@gredice/game";
import { ListHeader } from "@signalco/ui-primitives/List";
import { SplitView } from "@signalco/ui/SplitView";
import { BlocksList } from "./BlocksList";
import { getEntitiesFormatted } from "@gredice/storage";
import { BlockData } from "../@types/BlockData";

export default async function BlockPage({ params }: { params: Promise<{ alias: string }> }) {
    const { alias } = await params;
    const blockData = await getEntitiesFormatted('block') as unknown as BlockData[];
    const entity = blockData.find((block) => block.information.label === alias);
    if (!entity) {
        notFound();
    }

    return (
        <div className="border-b">
            <SplitView>
                <Stack spacing={1} className="p-4 py-10">
                    <ListHeader header="Blokovi" />
                    <BlocksList blockData={blockData} />
                </Stack>
                <Stack spacing={4} className="p-4 py-10">
                    <PageHeader
                        visual={(
                            <EntityViewer
                                entityName={entity.information.name}
                                appBaseUrl="https://vrt.gredice.com" />
                        )}
                        header={entity.information.label}
                        subHeader={entity.information.shortDescription}
                    />
                </Stack>
            </SplitView>
        </div>
    )
}