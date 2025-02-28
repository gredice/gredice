import { notFound } from "next/navigation";
import { PageHeader } from "../../../components/shared/PageHeader";
import { Stack } from "@signalco/ui-primitives/Stack";
import { ListHeader } from "@signalco/ui-primitives/List";
import { SplitView } from "@signalco/ui/SplitView";
import { BlocksList } from "./BlocksList";
import { BlockData } from "../@types/BlockData";
import Markdown from "react-markdown";
import { BlockImage } from "../../../components/blocks/BlockImage";
import { Typography } from "@signalco/ui-primitives/Typography";
import { AttributeCard } from "../../../components/attributes/DetailCard";
import { Layers2, Ruler } from "lucide-react";
import { client } from "@gredice/client";

function BlockAttributes({ attributes }: { attributes: BlockData['attributes'] }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <AttributeCard icon={<Ruler className="size-5" />} header="Visina" value={`${Math.round(attributes.height * 100)} cm`} />
            <AttributeCard icon={<Layers2 className="size-5" />} header="Slaganje" value={attributes.stackable === true ? 'Da' : 'Ne'} />
        </div>
    )
}

export default async function BlockPage({ params }: { params: Promise<{ alias: string }> }) {
    const { alias } = await params;
    // TODO: Query API for single entities with filter on 'label' attribute
    const blockData = await (await client().api.directories.entities[":entityType"].$get({
        param: {
            entityType: "block"
        }
    })).json() as BlockData[];
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
                            <BlockImage
                                blockName={entity.information.name}
                                width={142}
                                height={142}
                            />
                        )}
                        header={entity.information.label}
                        subHeader={entity.information.shortDescription}
                    />
                    <div className="prose prose-p:my-2 max-w-none">
                        <Markdown>{entity.information.fullDescription}</Markdown>
                    </div>
                    <Stack spacing={1}>
                        <Typography level="h5">Svojstva</Typography>
                        <BlockAttributes attributes={entity.attributes} />
                    </Stack>
                </Stack>
            </SplitView>
        </div>
    )
}