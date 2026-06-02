import { useBlockData } from '../hooks/useBlockData';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { getStackHeight } from './stackHeightCore';

export { getBlockDataByName, getStackHeight } from './stackHeightCore';

export function useStackHeight(stack: Stack | undefined, stopBlock?: Block) {
    const { data: blockData } = useBlockData();
    return getStackHeight(blockData, stack, stopBlock);
}
