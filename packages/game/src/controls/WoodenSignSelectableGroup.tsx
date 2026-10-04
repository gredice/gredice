import type { PropsWithChildren } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import type { Block } from '../types/Block';
import { useGameState } from '../useGameState';
import { useWoodenSignParam } from '../useUrlState';
import { useDeferredSingleClick } from './useDeferredSingleClick';
import { useHoveredBlockStore } from './useHoveredBlockStore';

export function WoodenSignSelectableGroup({
    children,
    block,
}: PropsWithChildren<{ block: Block }>) {
    const { track } = useGameAnalytics();
    const hovered = useHoveredBlockStore();
    const hasActiveDragPreview = useGameState((state) =>
        Boolean(state.activeDragPreview),
    );
    const [, setWoodenSignParam] = useWoodenSignParam();
    const handleClick = useDeferredSingleClick(handleSelected);

    function handleSelected() {
        if (hasActiveDragPreview) {
            return;
        }

        track('game_wooden_sign_editor_opened', {
            block_id: block.id,
        });
        setWoodenSignParam(block.id);
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
