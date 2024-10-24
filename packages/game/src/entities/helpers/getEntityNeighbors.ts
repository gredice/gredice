import { Block } from "../../types/Block";
import { Stack } from "../../types/Stack";
import { getStack } from "../../utils/getStack";

export function getEntityNeighbors(stack: Stack, block: Block) {
    const currentInStackIndex = stack.blocks.indexOf(block);
    const neighbors = {
        w: getStack({ x: stack.position.x, z: stack.position.z + 1 })?.blocks.at(currentInStackIndex)?.name === block.name,
        wr: getStack({ x: stack.position.x, z: stack.position.z + 1 })?.blocks.at(currentInStackIndex)?.rotation ?? 0,
        n: getStack({ x: stack.position.x + 1, z: stack.position.z })?.blocks.at(currentInStackIndex)?.name === block.name,
        nr: getStack({ x: stack.position.x + 1, z: stack.position.z })?.blocks.at(currentInStackIndex)?.rotation ?? 0,
        e: getStack({ x: stack.position.x, z: stack.position.z - 1 })?.blocks.at(currentInStackIndex)?.name === block.name,
        er: getStack({ x: stack.position.x, z: stack.position.z - 1 })?.blocks.at(currentInStackIndex)?.rotation ?? 0,
        s: getStack({ x: stack.position.x - 1, z: stack.position.z })?.blocks.at(currentInStackIndex)?.name === block.name,
        sr: getStack({ x: stack.position.x - 1, z: stack.position.z })?.blocks.at(currentInStackIndex)?.rotation ?? 0
    };
    return {
        total: (neighbors.w ? 1 : 0) + (neighbors.n ? 1 : 0) + (neighbors.e ? 1 : 0) + (neighbors.s ? 1 : 0),
        ...neighbors
    };
}