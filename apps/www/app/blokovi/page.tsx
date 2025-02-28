import { Gallery } from "@signalco/ui/Gallery";
import { Stack } from "@signalco/ui-primitives/Stack";
import { PageHeader } from "../../components/shared/PageHeader";
import { ItemCard } from "../../components/shared/ItemCard";
import { orderBy } from "@signalco/js";
import { BlockData } from "./@types/BlockData";
import { BlockImage } from "../../components/blocks/BlockImage";
import { client } from "@gredice/client";

function BlockGalleryItem(props: BlockData) {
    const entity = props;
    return (
        <ItemCard label={entity.information.label} href={`/blokovi/${entity.information.label}`}>
            <BlockImage blockName={entity.information.name} fill />
        </ItemCard>
    );
}

export default async function BlocksPage() {
    const entities = await (await client().api.directories.entities[":entityType"].$get({
        param: {
            entityType: "block"
        }
    })).json() as BlockData[];
    const blocksArray = orderBy(entities, (a, b) => a.information.label.localeCompare(b.information.label));
    return (
        <Stack>
            <PageHeader
                padded
                header="Blokovi"
                subHeader="Pregledaj sve blokove koje možeš koristiti u svom vrtu." />
            <Gallery
                gridHeader={''}
                items={blocksArray}
                itemComponent={BlockGalleryItem} />
        </Stack>
    );
}