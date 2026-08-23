import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import type { Block } from '../../types/Block';
import type { GardenStack } from '../../types/Stack';

export function resolveEntityNeighbors(
    stacks: GardenStack[] | undefined,
    stack: GardenStack,
    block: Block,
    isCompatibleName?: (name: string) => boolean,
) {
    function getStack({ x, z }: { x: number; z: number }) {
        return stacks?.find(
            (stack) => stack.position.x === x && stack.position.z === z,
        );
    }

    const currentInStackIndex = stack.blocks.indexOf(block);
    function getNeighbor({ x, z }: { x: number; z: number }) {
        return getStack({ x, z })?.blocks.at(currentInStackIndex);
    }

    function isCompatibleNeighbor(neighbor: Block | undefined) {
        return neighbor
            ? (isCompatibleName?.(neighbor.name) ??
                  neighbor.name === block.name)
            : false;
    }

    const west = getNeighbor({
        x: stack.position.x,
        z: stack.position.z + 1,
    });
    const north = getNeighbor({
        x: stack.position.x + 1,
        z: stack.position.z,
    });
    const east = getNeighbor({
        x: stack.position.x,
        z: stack.position.z - 1,
    });
    const south = getNeighbor({
        x: stack.position.x - 1,
        z: stack.position.z,
    });
    const neighbors = {
        w: isCompatibleNeighbor(west),
        wr: west?.rotation ?? 0,
        n: isCompatibleNeighbor(north),
        nr: north?.rotation ?? 0,
        e: isCompatibleNeighbor(east),
        er: east?.rotation ?? 0,
        s: isCompatibleNeighbor(south),
        sr: south?.rotation ?? 0,
    };
    return {
        total:
            (neighbors.w ? 1 : 0) +
            (neighbors.n ? 1 : 0) +
            (neighbors.e ? 1 : 0) +
            (neighbors.s ? 1 : 0),
        ...neighbors,
    };
}

export function useEntityNeighbors(
    stack: GardenStack,
    block: Block,
    isCompatibleName?: (name: string) => boolean,
) {
    const { data: garden } = useCurrentGarden();

    return resolveEntityNeighbors(
        garden?.stacks,
        stack,
        block,
        isCompatibleName,
    );
}
