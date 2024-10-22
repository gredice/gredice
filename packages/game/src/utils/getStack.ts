import type { Vector3 } from "three";
import { useGameState } from "../useGameState";

export function getStack({ x, z }: Vector3 | { x: number, z: number }) {
    return useGameState.getState().stacks.find(stack => stack.position.x === x && stack.position.z === z);
}