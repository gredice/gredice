/** A serialized block with the price paid for it, when known. */
export type GardenBlockWithPaidSunflowers<TBlock> = TBlock & {
    paidSunflowers?: number | null;
};

/**
 * Adds each block's stored paid price (`garden_blocks.paid_sunflowers`) to a
 * serialized garden's stacks. Recycling refunds exactly that price, so the
 * game can show the refund before the player confirms a removal.
 *
 * `paidSunflowersByBlockId` is null for anyone but the garden's own account:
 * every block then reads `paidSunflowers: null`, the same as a block whose
 * refund the client cannot know (legacy blocks with no stored price, whose
 * refund the server works out from purchase records, and pack blocks, which
 * the pack lifecycle refunds). The field is typed optional so garden data
 * from other sources (public gardens, fixtures) stays valid without it.
 *
 * Keep this out of the garden preview source revision: the price never
 * changes how a garden looks.
 */
export function withGardenBlockPaidSunflowers<TBlock extends { id: string }>(
    stacks: Record<string, Record<string, TBlock[]>>,
    paidSunflowersByBlockId: ReadonlyMap<string, number | null> | null,
) {
    const result: Record<
        string,
        Record<string, GardenBlockWithPaidSunflowers<TBlock>[]>
    > = {};
    for (const [x, column] of Object.entries(stacks)) {
        const nextColumn: Record<
            string,
            GardenBlockWithPaidSunflowers<TBlock>[]
        > = {};
        for (const [y, blocks] of Object.entries(column)) {
            nextColumn[y] = blocks.map((block) => ({
                ...block,
                paidSunflowers: paidSunflowersByBlockId?.get(block.id) ?? null,
            }));
        }
        result[x] = nextColumn;
    }
    return result;
}

/** Paid prices by block id, for the garden owner's view. */
export function createGardenBlockPaidSunflowersById(
    blocks: readonly { id: string; paidSunflowers: number | null }[],
): ReadonlyMap<string, number | null> {
    return new Map(blocks.map((block) => [block.id, block.paidSunflowers]));
}
