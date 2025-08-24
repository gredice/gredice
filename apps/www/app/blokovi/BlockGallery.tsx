'use client';

import type { BlockData } from '@gredice/client';
import { BlockImage } from '@gredice/ui/BlockImage';
import { useSearchParam } from '@signalco/hooks/useSearchParam';
import { orderBy } from '@signalco/js';
import { Gallery } from '@signalco/ui/Gallery';
import { cx } from '@signalco/ui-primitives/cx';
import { Row } from '@signalco/ui-primitives/Row';
import { Typography } from '@signalco/ui-primitives/Typography';
import { ItemCard } from '../../components/shared/ItemCard';
import { KnownPages } from '../../src/KnownPages';

function BlockGalleryItem(
    props: Omit<BlockData, 'id'> & { id: string; showPrices?: boolean },
) {
    const { showPrices = true, ...entity } = props;
    return (
        <ItemCard
            label={
                <Row
                    spacing={1}
                    justifyContent={cx(showPrices ? 'space-between' : 'center')}
                >
                    <Typography>{entity.information.label}</Typography>
                    {showPrices && entity.prices && (
                        <Typography
                            level="body2"
                            className="flex flex-row gap-2"
                        >
                            <span>🌻</span>
                            <span>{entity.prices.sunflowers ?? '-'}</span>
                        </Typography>
                    )}
                </Row>
            }
            href={KnownPages.Block(entity.information.label)}
        >
            <BlockImage blockName={entity.information.name} fill />
        </ItemCard>
    );
}

export function BlockGallery({ blocks }: { blocks: BlockData[] | undefined }) {
    const [search] = useSearchParam('pretraga');
    const filteredBlocks = orderBy(blocks ?? [], (a, b) =>
        a.information.name.localeCompare(b.information.label),
    )
        .filter(
            (blocks) =>
                !search ||
                blocks.information.label
                    .toLowerCase()
                    .includes(search.toLowerCase()),
        )
        .map((blocks) => ({ ...blocks, id: blocks.id.toString() }));

    return (
        <>
            {filteredBlocks.length === 0 && (
                <Typography level="body2">Nema rezultata pretrage.</Typography>
            )}
            <Gallery
                gridHeader={''}
                items={filteredBlocks}
                itemComponent={BlockGalleryItem}
            />
        </>
    );
}
