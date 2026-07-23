import type { LSystemSymbol } from '../lib/l-system';

export type GeneratedLSystemSymbolsByKey = Record<string, LSystemSymbol[]>;

export function reconcileGeneratedLSystemBatchState(
    current: GeneratedLSystemSymbolsByKey,
    activeKeys: string[],
    incoming: GeneratedLSystemSymbolsByKey,
) {
    const activeKeySet = new Set(activeKeys);
    const currentKeys = Object.keys(current);
    let changed = currentKeys.some((key) => !activeKeySet.has(key));

    for (const key of activeKeys) {
        const nextSymbols = incoming[key] ?? current[key];
        if (nextSymbols !== current[key]) {
            changed = true;
            break;
        }
    }

    if (!changed) {
        return current;
    }

    const next: GeneratedLSystemSymbolsByKey = {};
    for (const key of activeKeys) {
        const symbols = incoming[key] ?? current[key];
        if (symbols) {
            next[key] = symbols;
        }
    }

    return next;
}
