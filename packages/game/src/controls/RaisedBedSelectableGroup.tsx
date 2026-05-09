import { type PropsWithChildren, useRef } from 'react';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import type { Block } from '../types/Block';
import {
    useRemoveRaisedBedCloseupParam,
    useSetRaisedBedCloseupParam,
} from '../useRaisedBedCloseup';
import { useHoveredBlockStore } from './useHoveredBlockStore';

export function RaisedBedSelectableGroup({
    children,
    block,
    raisedBedName,
}: PropsWithChildren<{ block: Block; raisedBedName: string }>) {
    const groupRef = useRef(null);
    const { track } = useGameAnalytics();
    const hovered = useHoveredBlockStore();
    const { mutate: setRaisedBedCloseupParam } = useSetRaisedBedCloseupParam();
    const { mutate: removeRaisedBedCloseupParam } =
        useRemoveRaisedBedCloseupParam();

    function handleSelected() {
        handleOpenChange(true);
    }

    function handleOpenChange(open: boolean) {
        if (open) {
            track('game_raised_bed_opened', {
                block_id: block.id,
                raised_bed_name: raisedBedName,
            });
            setRaisedBedCloseupParam(raisedBedName);
            hovered.setHoveredBlock(null);
        } else {
            removeRaisedBedCloseupParam();
        }
    }

    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: Three.js element is interactive
        <group
            ref={groupRef}
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
            onClick={handleSelected}
        >
            {children}
        </group>
    );
}
