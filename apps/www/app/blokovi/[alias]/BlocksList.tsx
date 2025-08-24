'use client';

import type { BlockData } from '@gredice/client';
import { BlockImage } from '@gredice/ui/BlockImage';
import { orderBy } from '@signalco/js';
import { useParams } from 'next/navigation';
import { ListCollapsable } from '../../../components/shared/ListCollapsable';
import { KnownPages } from '../../../src/KnownPages';

export function BlocksList({
    blockData,
}: {
    blockData: BlockData[] | undefined;
}) {
    const { alias: aliasUnescaped } = useParams<{ alias: string }>();
    const alias = decodeURIComponent(aliasUnescaped);

    const entitiesArray = orderBy(blockData ?? [], (a, b) =>
        a.information.label.localeCompare(b.information.label),
    );

    const items = entitiesArray.map((entity) => ({
        value: entity.information.label,
        label: entity.information.label,
        href: KnownPages.Block(entity.information.label),
        icon: (
            <BlockImage
                blockName={entity.information.name}
                className="size-6 md:size-8"
                width={32}
                height={32}
            />
        ),
    }));

    return <ListCollapsable value={alias} items={items} />;
}
