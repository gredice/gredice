'use client';

import type { BlockData } from '@gredice/client';
import { Html } from '@react-three/drei';
import type { CurrentGarden } from '../hooks/useCurrentGarden';
import type { GardenStack } from '../types/Stack';
import { useGameState } from '../useGameState';
import { getRaisedBedBlockIds } from '../utils/raisedBedBlocks';
import { getStackHeight } from '../utils/stackHeightCore';
import {
    RaisedBedNotificationBubbleContent,
    type SelectedRaisedBedGardenNotification,
    useRaisedBedNotificationSurface,
} from './RaisedBedNotificationSurface';

export {
    RaisedBedNotificationBubbleContent,
    useRaisedBedNotificationSurface,
} from './RaisedBedNotificationSurface';

type RaisedBedNotificationGarden = Pick<CurrentGarden, 'id' | 'raisedBeds'> & {
    stacks: GardenStack[];
};

type RaisedBedNotificationAnchorGarden = {
    raisedBeds: {
        blockId: string | null;
        id: number;
        orientation?: 'horizontal' | 'vertical';
    }[];
    stacks: GardenStack[];
};

const raisedBedNotificationAnchorOffsetY = 2.25;

function findBlockPlacement(
    garden: RaisedBedNotificationAnchorGarden,
    blockId: string,
) {
    for (const stack of garden.stacks) {
        const block = stack.blocks.find(
            (candidate) => candidate.id === blockId,
        );
        if (block) {
            return { block, stack };
        }
    }
    return null;
}

export function getRaisedBedNotificationAnchor(
    blockData: BlockData[] | null | undefined,
    garden: RaisedBedNotificationAnchorGarden,
    raisedBedId: number,
): [x: number, y: number, z: number] | null {
    const placements = getRaisedBedBlockIds(garden, raisedBedId).flatMap(
        (blockId) => {
            const placement = findBlockPlacement(garden, blockId);
            return placement ? [placement] : [];
        },
    );
    if (!placements.length) {
        return null;
    }

    const x =
        placements.reduce(
            (sum, placement) => sum + placement.stack.position.x,
            0,
        ) / placements.length;
    const z =
        placements.reduce(
            (sum, placement) => sum + placement.stack.position.z,
            0,
        ) / placements.length;
    const y = Math.max(
        ...placements.map(
            ({ block, stack }) =>
                getStackHeight(blockData, stack, block) +
                raisedBedNotificationAnchorOffsetY,
        ),
    );

    return [x, y, z];
}

export function RaisedBedNotificationBubble({
    notification,
    onOpen,
    position,
}: {
    notification: SelectedRaisedBedGardenNotification;
    onOpen: (notification: SelectedRaisedBedGardenNotification) => void;
    position: [x: number, y: number, z: number];
}) {
    return (
        <Html position={position} zIndexRange={[45, 31]}>
            <div className="-translate-x-1/2 -translate-y-[calc(100%+0.5rem)]">
                <RaisedBedNotificationBubbleContent
                    notification={notification}
                    onOpen={onOpen}
                />
            </div>
        </Html>
    );
}

export function RaisedBedNotificationBubbles({
    blockData,
    garden,
}: {
    blockData: BlockData[] | null | undefined;
    garden: RaisedBedNotificationGarden | null | undefined;
}) {
    const view = useGameState((state) => state.view);
    const hasActivePlacement = useGameState(
        (state) =>
            state.isDragging ||
            state.pickupBlock !== null ||
            state.activeDragPreview !== null ||
            state.hudPlacementDrag !== null,
    );
    const { notifications, openNotification } =
        useRaisedBedNotificationSurface(garden);

    if (!garden || view === 'closeup' || hasActivePlacement) {
        return null;
    }

    return notifications.map((notification) => {
        const position = getRaisedBedNotificationAnchor(
            blockData,
            garden,
            notification.raisedBedId,
        );
        return position ? (
            <RaisedBedNotificationBubble
                key={notification.id}
                notification={notification}
                onOpen={openNotification}
                position={position}
            />
        ) : null;
    });
}
