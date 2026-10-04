import type { PropsWithChildren } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import type { Block } from '../types/Block';
import { useGameState } from '../useGameState';
import {
    gardenBoxesInventoryTab,
    useBackpackInventoryParams,
} from '../useUrlState';
import { useDeferredSingleClick } from './useDeferredSingleClick';
import { useHoveredBlockStore } from './useHoveredBlockStore';

export function GardenBoxSelectableGroup({
    children,
    block,
}: PropsWithChildren<{ block: Block }>) {
    const { track } = useGameAnalytics();
    const hovered = useHoveredBlockStore();
    const hasActiveDragPreview = useGameState((state) =>
        Boolean(state.activeDragPreview),
    );
    const [, setBackpackInventoryParams] = useBackpackInventoryParams();
    const handleClick = useDeferredSingleClick(handleSelected);

    function handleSelected() {
        if (hasActiveDragPreview) {
            return;
        }

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
                if (hasActiveDragPreview) {
                    return;
                }

                event.stopPropagation();
                hovered.setHoveredBlock(block);
            }}
            onPointerLeave={(event) => {
                if (hovered.hoveredBlock === block) {
                    event.stopPropagation();
                    hovered.setHoveredBlock(null);
                }
            }}
            onClick={handleClick}
        >
            {children}
        </group>
    );
}
