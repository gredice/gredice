import type { GameState } from '../../useGameState';
import type { Block } from '../Block';
import type { Stack } from '../Stack';

export type EntityInstanceProps = {
    stack: Stack;
    block: Block;
    stacks?: Stack[];
    rotation: number;
    variant?: number | null;
    farmId?: number | null;
    weather?: Partial<NonNullable<GameState['weather']>>;
    weatherDisabled?: boolean;
};
