/** Semantic deadlines follow monotonic elapsed time, independently of capped animation deltas. */
export function createSceneElapsedTimeReader(
    now: () => number,
    readFixedTime: () => number | undefined,
) {
    const origin = now();
    return () => {
        const fixed = readFixedTime();
        return fixed === undefined
            ? Math.max(0, (now() - origin) / 1000)
            : fixed;
    };
}
