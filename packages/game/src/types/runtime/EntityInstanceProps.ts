import type { Block } from '../Block';
import type { Stack } from '../Stack';

export type EntityInstanceProps = {
    stack: Stack;
    block: Block;
    stacks?: Stack[];
    rotation: number;
    variant?: number | null;
};
