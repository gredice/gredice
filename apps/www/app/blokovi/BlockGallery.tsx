'use client';

import { Gallery } from "@signalco/ui/Gallery";
import { ItemCard } from "../../components/shared/ItemCard";
import { BlockImage } from "../../components/blocks/BlockImage";
import { BlockData } from "./@types/BlockData";
import { orderBy } from "@signalco/js";
import { useSearchParam } from "@signalco/hooks/useSearchParam";
import { Typography } from "@signalco/ui-primitives/Typography";

function BlockGalleryItem(props: BlockData) {
    const entity = props;
    return (
        <ItemCard label={entity.information.label} href={`/blokovi/${entity.information.label}`}>
            <BlockImage blockName={entity.information.name} fill />
        </ItemCard>
    );
}

export function BlockGallery({ blocks }: { blocks: BlockData[] }) {
    const [search] = useSearchParam('pretraga');
    const filteredBlocks = orderBy(blocks, (a, b) => a.information.name.localeCompare(b.information.label))
        .filter(blocks => !search || blocks.information.label.toLowerCase().includes(search.toLowerCase()))
        .map(blocks => ({ ...blocks, id: blocks.id.toString() }));

    return (
        <>
            {filteredBlocks.length === 0 && (
                <Typography level="body2">Nema rezultata pretrage.</Typography>
            )}
            <Gallery
                gridHeader={''}
                items={filteredBlocks}
                itemComponent={BlockGalleryItem} />
        </>
    )
}