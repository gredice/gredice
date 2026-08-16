import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import type { Block } from '../../types/Block';
import type { GardenStack } from '../../types/Stack';
import {
    doesFenceOwnMixedSpan,
    doesFenceOwnSpan,
    getFenceExtensionRotations,
    isFenceBlockName,
    resolveFenceConnection,
} from '../fenceConnections';
import { resolveEntityNeighbors } from './useEntityNeighbors';

export function resolveFenceConnectionState(
    stacks: GardenStack[] | undefined,
    stack: GardenStack,
    block: Block,
    fallbackRotation: number,
) {
    const allNeighbors = resolveEntityNeighbors(
        stacks,
        stack,
        block,
        isFenceBlockName,
    );
    const ownedNeighbors = resolveEntityNeighbors(
        stacks,
        stack,
        block,
        (neighborName) => doesFenceOwnSpan(block.name, neighborName),
    );
    const ownedMixedNeighbors = resolveEntityNeighbors(
        stacks,
        stack,
        block,
        (neighborName) => doesFenceOwnMixedSpan(block.name, neighborName),
    );

    return {
        connection: resolveFenceConnection(ownedNeighbors, fallbackRotation),
        extensionRotations: getFenceExtensionRotations(ownedMixedNeighbors),
        hasAdjacentFence: allNeighbors.total > 0,
    };
}

export function useFenceConnectionState(
    stack: GardenStack,
    block: Block,
    fallbackRotation: number,
) {
    const { data: garden } = useCurrentGarden();
    return resolveFenceConnectionState(
        garden?.stacks,
        stack,
        block,
        fallbackRotation,
    );
}
