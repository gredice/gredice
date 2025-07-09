import { notFound } from "next/navigation";
import { PageHeader } from "../../../components/shared/PageHeader";
import { Stack } from "@signalco/ui-primitives/Stack";
import { ListHeader } from "@signalco/ui-primitives/List";
import { SplitView } from "@signalco/ui/SplitView";
import { BlocksList } from "./BlocksList";
import { BlockImage } from "@gredice/ui/BlockImage";
import { Typography } from "@signalco/ui-primitives/Typography";
import { AttributeCard } from "../../../components/attributes/DetailCard";
import { Layers, Ruler } from "@signalco/ui-icons";
import { BlockData, directoriesClient } from "@gredice/client";
import { Markdown } from "../../../components/shared/Markdown";
import { FeedbackModal } from "../../../components/shared/feedback/FeedbackModal";
import { Row } from "@signalco/ui-primitives/Row";
import { Metadata } from "next";

export const revalidate = 3600; // 1 hour
export async function generateMetadata({ params }: { params: Promise<{ alias: string }> }): Promise<Metadata> {
    const { alias: aliasUnescaped } = await params;
    const alias = aliasUnescaped ? decodeURIComponent(aliasUnescaped) : null;
    const blockData = (await directoriesClient().GET('/entities/block')).data;
    const block = blockData?.find((block) => block.information.label === alias);
    if (!block) {
        return {
            title: "Blok nije pronađen",
            description: "Blok koji tražiš nije pronađen.",
        };
    }
    return {
        title: block.information.label,
        description: block.information.shortDescription,
    };
}

export async function generateStaticParams() {
    const entities = (await directoriesClient().GET('/entities/block')).data;
    return entities?.map((entity) => ({
        alias: String(entity.information.label),
    }));
}

function BlockAttributes({ prices, attributes }: BlockData) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <AttributeCard icon={<Ruler className="size-5" />} header="Visina" value={`${Math.round(attributes.height * 100)} cm`} />
            <AttributeCard icon={<Layers className="size-5" />} header="Slaganje" value={attributes.stackable === true ? 'Da' : 'Ne'} />
            <AttributeCard
                icon={<span className="text-xl">🌻</span>}
                header="Cijena"
                value={prices.sunflowers?.toString() ?? '-'} />
        </div>
    )
}

export default async function BlockPage({ params }: { params: Promise<{ alias: string }> }) {
    const { alias: aliasUnescaped } = await params;
    const alias = aliasUnescaped ? decodeURIComponent(aliasUnescaped) : null;
    if (!alias) {
        notFound();
    }

    // TODO: Query API for single entities with filter on 'label' attribute
    const blockData = (await directoriesClient().GET('/entities/block')).data;
    const entity = blockData?.find((block) => block.information.label === alias);
    if (!entity) {
        notFound();
    }

    return (
        <div className="border-b">
            <SplitView>
                <Stack spacing={1} className="md:p-4 py-2 md:py-10">
                    <ListHeader header="Blokovi" />
                    <BlocksList blockData={blockData} />
                </Stack>
                <Stack spacing={4} className="md:p-4 py-2 md:py-10">
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
                    <Markdown>{entity.information.fullDescription}</Markdown>
                    <Stack spacing={1}>
                        <Typography level="h5">Svojstva</Typography>
                        <BlockAttributes {...entity} />
                    </Stack>
                    <Row spacing={2}>
                        <Typography level="body1">Jesu li ti informacije korisne?</Typography>
                        <FeedbackModal
                            topic="www/blocks/details"
                            data={{
                                blockName: entity.information.name
                            }} />
                    </Row>
                </Stack>
            </SplitView>
        </div>
    )
}