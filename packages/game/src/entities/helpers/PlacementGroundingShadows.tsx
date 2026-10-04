'use client';

import type { BlockData } from '@gredice/client';
import { useMemo } from 'react';
import { useBlockData } from '../../hooks/useBlockData';
import type { Stack } from '../../types/Stack';
import {
    type BlockPlacementDropAnimation,
    useGameState,
} from '../../useGameState';
import { getBlockHitboxSize } from '../../utils/blockHitbox';
import { getStackHeight } from '../../utils/stackHeightCore';
import { usePlacementGroundingShadow } from '../animals/ActorGroundingShadows';
import type {
    ActorGroundingShadowState,
    GroundingShadowProfile,
} from '../animals/actorGroundingShadowRegistry';

const placementShadowOpacity = 0.24;
const placementShadowMinimumHalfExtent = 0.12;

export type PlacementGroundingShadowDescriptor = {
    id: string;
    profile: GroundingShadowProfile;
    state: ActorGroundingShadowState;
};

export function resolvePlacementGroundingShadowProfile(
    blockData: BlockData | null | undefined,
): GroundingShadowProfile {
    const hitbox = getBlockHitboxSize(blockData);

    return {
        baseHalfLength: Math.max(
            placementShadowMinimumHalfExtent,
            hitbox.depth / 2,
        ),
        baseHalfWidth: Math.max(
            placementShadowMinimumHalfExtent,
            hitbox.width / 2,
        ),
        baseOpacity: placementShadowOpacity,
        cutoffHeight: Math.max(0.25, hitbox.height),
        maxFootprintScale: 1.15,
    };
}

export function resolvePlacementGroundingShadowDescriptors({
    animations,
    blockData,
    stacks,
}: {
    animations: Readonly<Record<string, BlockPlacementDropAnimation>>;
    blockData: BlockData[] | null | undefined;
    stacks: Stack[] | undefined;
}): PlacementGroundingShadowDescriptor[] {
    if (!stacks?.length) {
        return [];
    }

    const descriptors: PlacementGroundingShadowDescriptor[] = [];
    for (const [blockId, animation] of Object.entries(animations)) {
        if (!animation.visualStarted) {
            continue;
        }

        let matched:
            | {
                  block: Stack['blocks'][number];
                  stack: Stack;
              }
            | undefined;
        for (const stack of stacks) {
            const block = stack.blocks.find(
                (candidate) =>
                    candidate.id === blockId ||
                    candidate.id === animation.sourceBlockId,
            );
            if (block) {
                matched = { block, stack };
                break;
            }
        }
        if (!matched) {
            continue;
        }

        const entity = blockData?.find(
            (candidate) => candidate.information.name === matched?.block.name,
        );
        const receiverY =
            matched.stack.position.y +
            getStackHeight(blockData, matched.stack, matched.block);
        descriptors.push({
            id: `placement:${animation.renderId}`,
            profile: resolvePlacementGroundingShadowProfile(entity),
            state: {
                actorY: receiverY,
                receiverY,
                visible: true,
                x: matched.stack.position.x,
                yaw: matched.block.rotation * (Math.PI / 2),
                z: matched.stack.position.z,
            },
        });
    }

    return descriptors.sort((left, right) => left.id.localeCompare(right.id));
}

function PlacementGroundingShadow({
    descriptor,
}: {
    descriptor: PlacementGroundingShadowDescriptor;
}) {
    usePlacementGroundingShadow(descriptor);
    return null;
}

export function PlacementGroundingShadows({
    stacks,
}: {
    stacks: Stack[] | undefined;
}) {
    const { data: blockData } = useBlockData();
    const animations = useGameState(
        (state) => state.blockPlacementDropAnimations,
    );
    const descriptors = useMemo(
        () =>
            resolvePlacementGroundingShadowDescriptors({
                animations,
                blockData,
                stacks,
            }),
        [animations, blockData, stacks],
    );

    return descriptors.map((descriptor) => (
        <PlacementGroundingShadow key={descriptor.id} descriptor={descriptor} />
    ));
}
