import type { PropsWithChildren } from 'react';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import type { Block } from '../types/Block';
import { GiftBoxSelectableGroup } from './GiftBoxSelectableGroup';
import { RaisedBedSelectableGroup } from './RaisedBedSelectableGroup';

export function SelectableGroup({
    children,
    block,
}: PropsWithChildren<{ block: Block }>) {
    const { data: garden } = useCurrentGarden();

    if (block.name.startsWith('GiftBox_')) {
        return (
            <GiftBoxSelectableGroup block={block}>
                {children}
            </GiftBoxSelectableGroup>
        );
    }

    if (block.name !== 'Raised_Bed') {
        return <>{children}</>;
    }

    const raisedBed = garden?.raisedBeds.find(
        (bed) => bed.blockId === block.id,
    );
    if (!raisedBed) {
        return <>{children}</>;
    }

    return (
        <RaisedBedSelectableGroup block={block} raisedBedName={raisedBed.name}>
            {children}
        </RaisedBedSelectableGroup>
    );
}
