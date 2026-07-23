import type { LSystemSymbol } from '../lib/l-system';

export type GeneratedLSystemTaskResult = {
    symbols: LSystemSymbol[];
    taskKey: string;
};

export function resolveGeneratedLSystemTaskSymbols(
    result: GeneratedLSystemTaskResult | null,
    taskKey: string,
) {
    return result?.taskKey === taskKey ? result.symbols : null;
}
