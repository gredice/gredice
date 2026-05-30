import type { PropsWithChildren } from 'react';
import type { Block } from '../types/Block';
import { useGiftBoxParam } from '../useUrlState';
import { useDeferredSingleClick } from './useDeferredSingleClick';
import { useHoveredBlockStore } from './useHoveredBlockStore';

export function GiftBoxSelectableGroup({
    children,
    block,
}: PropsWithChildren<{ block: Block }>) {
    const hovered = useHoveredBlockStore();
    const [, setGiftBoxParam] = useGiftBoxParam();
    const handleClick = useDeferredSingleClick(handleSelected);

    function handleSelected() {
        setGiftBoxParam(block.id);
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
            onClick={handleClick}
        >
            {children}
        </group>
    );
}
