/** Immutable renderer edits for the opt-in local profiling fixture. */
export function editChunkMatrixProfile<
    T extends { stacks: Array<{ blocks: Array<{ rotation?: number }> }> },
>(garden: T, count: number, sequence = 0) {
    if (
        !Number.isInteger(count) ||
        count < 1 ||
        count > 4096 ||
        count > garden.stacks.length
    )
        return null;
    let changed = 0;
    const stacks = garden.stacks.map((stack, index) => {
        if (index >= count || stack.blocks.length === 0) return stack;
        changed++;
        return {
            ...stack,
            blocks: stack.blocks.map((block, blockIndex) =>
                blockIndex === stack.blocks.length - 1
                    ? { ...block, rotation: ((block.rotation ?? 0) + 1) % 4 }
                    : block,
            ),
        };
    });
    return {
        garden: { ...garden, stacks, matrixProfileSequence: sequence },
        changed,
    };
}

export function readChunkMatrixProfileCommand(value: unknown) {
    if (!value || typeof value !== 'object') return null;
    const count: unknown = Reflect.get(value, 'count');
    const sequence: unknown = Reflect.get(value, 'sequence');
    return typeof count === 'number' &&
        Number.isInteger(count) &&
        count >= 1 &&
        count <= 4096 &&
        typeof sequence === 'number' &&
        Number.isSafeInteger(sequence) &&
        sequence > 0
        ? { count, sequence }
        : null;
}
