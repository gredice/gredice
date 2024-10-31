import Image from "next/image";
import { Gallery } from "@signalco/ui/Gallery";
import { Stack } from "@signalco/ui-primitives/Stack";
import { PageHeader } from "../../components/shared/PageHeader";
import { ItemCard } from "../../components/shared/ItemCard";
import { orderBy } from "@signalco/js";
import { getEntitiesFormatted } from "@gredice/storage";
import { BlockData } from "./@types/BlockData";

function BlockGalleryItem(props: BlockData) {
    const entity = props;
    return (
        <ItemCard label={entity.information.label} href={`/blokovi/${entity.information.label}`}>
            <Image
                src={`/assets/blocks/${entity.information.name}.png`}
                fill
                alt={entity.information.label}
            />
        </ItemCard>
    );
}

export default async function BlocksPage() {
    const entities = await getEntitiesFormatted('block') as unknown as BlockData[];
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