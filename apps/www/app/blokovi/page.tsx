import Image from "next/image";
import { entities, Entity } from "../../../../packages/game/src/data/entities";
import { Gallery } from "@signalco/ui/Gallery";
import { Stack } from "@signalco/ui-primitives/Stack";
import { PageHeader } from "../../components/shared/PageHeader";
import { ItemCard } from "../../components/shared/ItemCard";
import { orderBy } from "@signalco/js";

function BlockGalleryItem(props: Entity & { id: string }) {
    const entity = props;
    return (
        <ItemCard label={entity.alias} href={`/blokovi/${entity.alias}`}>
            <Image
                src={`/assets/blocks/${entity.name}.png`}
                fill
                alt={entity.alias}
            />
        </ItemCard>
    );
}

export default function BlocksPage() {
    const entitiesArray: Array<Entity & { id: string }> = orderBy((Object.keys(entities) as Array<keyof typeof entities>)
        .map((entityKey) => ({
            id: entities[entityKey].name,
            ...entities[entityKey]
        })), (a, b) => a.alias.localeCompare(b.alias));

    return (
        <Stack>
            <PageHeader
                padded
                header="Blokovi"
                subHeader="Pregledaj sve blokove koje možeš koristiti u svom vrtu." />
            <Gallery
                gridHeader={''}
                items={entitiesArray}
                itemComponent={BlockGalleryItem} />
        </Stack>
    );
}