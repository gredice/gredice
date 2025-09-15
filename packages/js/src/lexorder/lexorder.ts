// Inspired by:
// - https://stackoverflow.com/a/49956113/563228
// - https://stackoverflow.com/questions/38923376/return-a-new-string-that-sorts-between-two-given-strings/38927158#38927158

export type LexorderOptions = {
    start?: string;
    mid?: string;
    end?: string;
};

function trimLast(curr: string) {
    return curr.substring(0, curr.length - 1);
}

function incrementLast(
    curr: string | null | undefined,
    mid: string,
    end: string,
) {
    if (!curr) return mid;

    let nextIdentifier = String.fromCharCode(
        curr.charCodeAt(curr.length - 1) + 1,
    );

    // Edge case: We are at the end, insert next level mid
    if (nextIdentifier === end) nextIdentifier = end + mid;

    return trimLast(curr) + nextIdentifier;
}

function decrementLast(
    curr: string | null | undefined,
    mid: string,
    start: string,
) {
    if (!curr) return mid;

    let nextIdentifier = String.fromCharCode(
        curr.charCodeAt(curr.length - 1) - 1,
    );

    // Edge case: We are at the start, insert next level mid
    if (nextIdentifier === start) nextIdentifier = start + mid;

    return trimLast(curr) + nextIdentifier;
}

/**
 * Given two lex identifiers, returns a lex identifier that is between them.
 * Can be used to (change) item order in a list without having to re-order all items.
 */
export function lexinsert(
    prev?: string | null | undefined,
    next?: string | null | undefined,
    options?: LexorderOptions,
) {
    const { start = 'a', mid = 'i', end = 'z' } = options ?? {};

    if (!prev && !next) return mid;

    if (!next && prev && prev[prev.length - 1] === end) return prev + mid;

    if (!prev && next && next[next.length - 1] === start) return next + mid;

    if (
        prev &&
        next &&
        prev.length === next.length &&
        prev.substring(0, prev.length - 1) ===
            next.substring(0, next.length - 1) &&
        Math.abs(
            next.charCodeAt(next.length - 1) - prev.charCodeAt(prev.length - 1),
        ) <= 1
    )
        return prev + mid;

    if ((next?.length ?? 0) > (prev?.length ?? 0))
        return decrementLast(next, mid, start);
    return incrementLast(prev, mid, end);
}
