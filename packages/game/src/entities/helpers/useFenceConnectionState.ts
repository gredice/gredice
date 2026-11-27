import { useContext } from 'react';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import type { Block } from '../../types/Block';
import type { GardenStack } from '../../types/Stack';
import {
    doesFenceOwnMixedSpan,
    doesFenceOwnSpan,
    getFenceExtensionRotations,
    isFenceTopologyBlockName,
    resolveFenceConnection,
} from '../fenceConnections';
import { EntityNeighborStacksContext } from './EntityNeighborStacksContext';
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
        isFenceTopologyBlockName,
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
    const neighborStacks = useContext(EntityNeighborStacksContext);
    return resolveFenceConnectionState(
        neighborStacks ?? garden?.stacks,
        stack,
        block,
        fallbackRotation,
    );
}
