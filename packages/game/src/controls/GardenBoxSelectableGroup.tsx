import type { PropsWithChildren } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import type { Block } from '../types/Block';
import {
    gardenBoxesInventoryTab,
    useBackpackInventoryParams,
} from '../useUrlState';
import { useHoveredBlockStore } from './useHoveredBlockStore';

export function GardenBoxSelectableGroup({
    children,
    block,
}: PropsWithChildren<{ block: Block }>) {
    const { track } = useGameAnalytics();
    const hovered = useHoveredBlockStore();
    const [, setBackpackInventoryParams] = useBackpackInventoryParams();

    function handleSelected() {
        track('game_garden_box_inventory_opened', {
            block_id: block.id,
        });
        setBackpackInventoryParams({
            ruksak: true,
            'ruksak-kartica': gardenBoxesInventoryTab,
        });
        hovered.setHoveredBlock(null);
    }

    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: Three.js element is interactive
        <group
            onPointerEnter={(event) => {
                event.stopPropagation();
                hovered.setHoveredBlock(block);
            }}
            onPointerLeave={(event) => {
                if (hovered.hoveredBlock === block) {
                    event.stopPropagation();
                    hovered.setHoveredBlock(null);
                }
            }}
            onClick={(event) => {
                event.stopPropagation();
                handleSelected();
            }}
        >
            {children}
        </group>
    );
}
