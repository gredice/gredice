export function orderBy<T>(
    items: readonly T[],
    compareFn: (a: T, b: T) => number,
) {
    return [...items].sort(compareFn);
}
