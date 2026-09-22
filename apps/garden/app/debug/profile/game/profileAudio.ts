/** Reproducible, opt-in leaf-rustle QA; absent/unknown values keep mode weather. */
export function resolveGameProfileLeafWind(value: string | undefined) {
    if (value === 'calm') return 0;
    if (value === 'light') return 0.7;
    if (value === 'strong') return 2.4;
    return undefined;
}
