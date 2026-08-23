import { slugify } from '@gredice/js/slug';

export const stoneCornerStairsBlockAlias = 'kutne-kamene-stube';

const stoneCornerStairsBlockNames = new Set([
    'Block_Stone_Stairs_Half',
    'Block_Stone_Stairs_Corner',
]);
const stoneCornerStairsBlockLabelAliases = new Set([
    'kamene-polustube',
    stoneCornerStairsBlockAlias,
]);

type BlockRouteCandidate = {
    slug?: string | null;
    information: {
        name: string;
        label: string;
    };
};

function isStoneCornerStairsBlock(block: BlockRouteCandidate): boolean {
    return (
        stoneCornerStairsBlockNames.has(block.information.name) ||
        stoneCornerStairsBlockLabelAliases.has(slugify(block.information.label))
    );
}

function blockMatchesAlias(
    block: BlockRouteCandidate,
    normalizedAlias: string,
): boolean {
    return (
        (block.slug ? slugify(block.slug) === normalizedAlias : false) ||
        slugify(block.information.label) === normalizedAlias
    );
}

export function getBlockRouteAlias(block: BlockRouteCandidate): string {
    if (isStoneCornerStairsBlock(block)) {
        return stoneCornerStairsBlockAlias;
    }

    return block.slug || slugify(block.information.label);
}

export function resolveBlockRoute<TBlock extends BlockRouteCandidate>(
    blocks: readonly TBlock[] | null | undefined,
    alias: string | null,
): TBlock | undefined {
    if (!alias) {
        return undefined;
    }

    const normalizedAlias = slugify(alias);
    const directMatch = blocks?.find((block) =>
        blockMatchesAlias(block, normalizedAlias),
    );
    if (directMatch) {
        return directMatch;
    }

    if (normalizedAlias !== stoneCornerStairsBlockAlias) {
        return undefined;
    }

    return (
        blocks?.find(
            (block) => block.information.name === 'Block_Stone_Stairs_Corner',
        ) ??
        blocks?.find(
            (block) => block.information.name === 'Block_Stone_Stairs_Half',
        ) ??
        blocks?.find(isStoneCornerStairsBlock)
    );
}

export function getBlockStaticParams(
    blocks: readonly BlockRouteCandidate[] | null | undefined,
): Array<{ alias: string }> {
    return Array.from(
        new Set(blocks?.map((block) => getBlockRouteAlias(block)) ?? []),
        (alias) => ({ alias }),
    );
}
