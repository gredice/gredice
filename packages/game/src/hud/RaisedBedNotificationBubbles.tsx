'use client';

import type { BlockData } from '@gredice/client';
import { Html } from '@react-three/drei';
import type { CurrentGarden } from '../hooks/useCurrentGarden';
import type { GardenStack } from '../types/Stack';
import { useGameState } from '../useGameState';
import { getRaisedBedFootprintSegments } from '../utils/raisedBedBlocks';
import { getStackHeight } from '../utils/stackHeightCore';
import {
    RaisedBedNotificationBubbleContent,
    RaisedBedNotificationImageViewer,
    type SelectedRaisedBedGardenNotification,
    useRaisedBedNotificationSurface,
} from './RaisedBedNotificationSurface';

export {
    RaisedBedNotificationBubbleContent,
    RaisedBedNotificationImageViewer,
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
    const blockId = garden.raisedBeds.find(
        (raisedBed) => raisedBed.id === raisedBedId,
    )?.blockId;
    const placement = blockId ? findBlockPlacement(garden, blockId) : null;
    if (!placement) {
        return null;
    }

    const segments = getRaisedBedFootprintSegments(placement.block.rotation);
    const centerOffset = segments.reduce(
        (sum, segment) => ({
            x: sum.x + segment.offset.x / segments.length,
            z: sum.z + segment.offset.z / segments.length,
        }),
        { x: 0, z: 0 },
    );
    const x = placement.stack.position.x + centerOffset.x;
    const z = placement.stack.position.z + centerOffset.z;
    const y =
        getStackHeight(blockData, placement.stack, placement.block) +
        raisedBedNotificationAnchorOffsetY;

    return [x, y, z];
}

export function RaisedBedNotificationBubble({
    notification,
    onDismiss,
    onOpen,
    onOpenImage,
    position,
}: {
    notification: SelectedRaisedBedGardenNotification;
    onDismiss: (notification: SelectedRaisedBedGardenNotification) => void;
    onOpen: (notification: SelectedRaisedBedGardenNotification) => void;
    onOpenImage: (
        notification: SelectedRaisedBedGardenNotification,
        imageUrl: string,
    ) => void;
    position: [x: number, y: number, z: number];
}) {
    return (
        <Html position={position} zIndexRange={[45, 31]}>
            <div className="-translate-x-1/2 -translate-y-[calc(100%+0.5rem)]">
                <RaisedBedNotificationBubbleContent
                    notification={notification}
                    onDismiss={onDismiss}
                    onOpen={onOpen}
                    onOpenImage={onOpenImage}
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
    const {
        closeImageViewer,
        dismissNotification,
        notifications,
        openImageNotification,
        openNotification,
        viewerImage,
    } = useRaisedBedNotificationSurface(garden);

    if (!garden || view === 'closeup' || hasActivePlacement) {
        return null;
    }

    return (
        <>
            {notifications.map((notification) => {
                const position = getRaisedBedNotificationAnchor(
                    blockData,
                    garden,
                    notification.raisedBedId,
                );
                return position ? (
                    <RaisedBedNotificationBubble
                        key={notification.id}
                        notification={notification}
                        onDismiss={dismissNotification}
                        onOpen={openNotification}
                        onOpenImage={openImageNotification}
                        position={position}
                    />
                ) : null;
            })}
            {viewerImage ? (
                <Html position={[0, 0, 0]} zIndexRange={[100, 100]}>
                    <RaisedBedNotificationImageViewer
                        image={viewerImage}
                        onClose={closeImageViewer}
                    />
                </Html>
            ) : null}
        </>
    );
}
