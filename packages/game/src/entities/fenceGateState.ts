import type { Block } from '../types/Block';
import { isFenceGateBlockName } from './fenceConnections';

export const fenceGateClosedVariant = 0;
export const fenceGateOpenVariant = 1;

export function isFenceGateOpen(block: Pick<Block, 'name' | 'variant'>) {
    return (
        isFenceGateBlockName(block.name) &&
        block.variant === fenceGateOpenVariant
    );
}

export function getToggledFenceGateVariant(
    block: Pick<Block, 'name' | 'variant'>,
) {
    return isFenceGateOpen(block)
        ? fenceGateClosedVariant
        : fenceGateOpenVariant;
}
