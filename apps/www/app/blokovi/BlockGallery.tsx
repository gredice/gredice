'use client';

import type { BlockData } from '@gredice/client';
import { orderBy } from '@gredice/js/arrays';
import { BlockImage } from '@gredice/ui/BlockImage';
import { Gallery } from '@gredice/ui/Gallery';
import { Row } from '@gredice/ui/Row';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { ItemCard } from '../../components/shared/ItemCard';
import { useClientSearchParam } from '../../hooks/useClientSearchParam';
import { normalizeSearchText } from '../../lib/search/normalizeSearchText';
import { KnownPages } from '../../src/KnownPages';

function BlockGalleryItem(
    props: Omit<BlockData, 'id'> & { id: string; showPrices?: boolean },
) {
    const { showPrices = true, ...entity } = props;
    return (
        <ItemCard
            label={
                <Row
                    spacing={2}
                    justifyContent={cx(showPrices ? 'space-between' : 'center')}
                >
                    <Typography>{entity.information.label}</Typography>
                    {showPrices &&
                        entity.prices &&
                        entity.prices.sunflowers > 0 && (
                            <Typography
                                level="body2"
                                className="flex flex-row gap-2"
                            >
                                <span>🌻</span>
                                <span>{entity.prices.sunflowers}</span>
                            </Typography>
                        )}
                </Row>
            }
            href={KnownPages.Block(entity.information.label)}
        >
            <BlockImage
                blockName={entity.information.name}
                fill
                preload
                sizes="(max-width: 768px) 50vw, (min-width: 768px) 33vw, (min-width: 1200px) 9vw"
            />
        </ItemCard>
    );
}

export function BlockGallery({ blocks }: { blocks: BlockData[] | undefined }) {
    const [search] = useClientSearchParam('pretraga');
    const normalizedSearch = normalizeSearchText(search);
    const filteredBlocks = orderBy(blocks ?? [], (a, b) =>
        a.information.name.localeCompare(b.information.label),
    )
        .filter(
            (blocks) =>
                !normalizedSearch ||
                normalizeSearchText(blocks.information.label).includes(
                    normalizedSearch,
                ),
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
