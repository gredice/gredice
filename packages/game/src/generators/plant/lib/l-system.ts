import type { Rule, RuleOption } from './plant-definitions';
import type { SeededRNG } from './rng';

export interface LSystemSymbol {
    char: string;
    generation: number;
    params?: number[];
    growthStart?: number;
}

const DEFAULT_CONTEXT_IGNORE = new Set([
    '[',
    ']',
    '+',
    '-',
    '&',
    '^',
    '/',
    '\\',
]);

function chooseWeightedRule(rules: RuleOption[], rng: SeededRNG): string {
    const totalWeight = rules.reduce((sum, rule) => sum + rule.weight, 0);
    let choice = rng.nextFloat() * totalWeight;

    for (const weightedRule of rules) {
        choice -= weightedRule.weight;
        if (choice <= 0) {
            return weightedRule.rule;
        }
    }
    return rules[rules.length - 1].rule; // Fallback
}

function hasContext(rule: RuleOption) {
    return Boolean(rule.left?.length || rule.right?.length);
}

function resolveContextSymbol(
    symbols: LSystemSymbol[],
    startIndex: number,
    direction: -1 | 1,
    ignore: Set<string>,
) {
    for (
        let index = startIndex + direction;
        index >= 0 && index < symbols.length;
        index += direction
    ) {
        const candidate = symbols[index];
        if (ignore.has(candidate.char)) {
            continue;
        }

        return candidate.char;
    }

    return undefined;
}

function matchesContext(
    rule: RuleOption,
    symbols: LSystemSymbol[],
    index: number,
) {
    if (!hasContext(rule)) {
        return true;
    }

    const ignore = new Set([...DEFAULT_CONTEXT_IGNORE, ...(rule.ignore ?? [])]);

    if (rule.left?.length) {
        const leftSymbol = resolveContextSymbol(symbols, index, -1, ignore);
        if (!leftSymbol || !rule.left.includes(leftSymbol)) {
            return false;
        }
    }

    if (rule.right?.length) {
        const rightSymbol = resolveContextSymbol(symbols, index, 1, ignore);
        if (!rightSymbol || !rule.right.includes(rightSymbol)) {
            return false;
        }
    }

    return true;
}

function parseSymbolParameters(rawParameters: string) {
    const trimmedParameters = rawParameters.trim();
    if (!trimmedParameters) {
        return [];
    }

    const parameters = trimmedParameters
        .split(',')
        .map((value) => Number(value.trim()));

    return parameters.some((value) => Number.isNaN(value))
        ? undefined
        : parameters;
}

function getCarryOverGroup(char: string) {
    switch (char) {
        case 'F':
        case 'S':
            return 'stem';
        case 'P':
        case 'R':
            return 'produce';
        default:
            return char;
    }
}

function getSymbolSizeWeight(symbol: LSystemSymbol) {
    const primaryParameter = symbol.params?.[0];
    if (
        typeof primaryParameter === 'number' &&
        Number.isFinite(primaryParameter)
    ) {
        return Math.max(0, Math.abs(primaryParameter));
    }

    return 1;
}

function applyInheritedGrowthStart(
    sourceSymbol: LSystemSymbol,
    replacementSymbols: LSystemSymbol[],
) {
    const carryOverGroup = getCarryOverGroup(sourceSymbol.char);
    let branchDepth = 0;
    const depthZeroMatches: number[] = [];
    const fallbackMatches: number[] = [];

    for (const [index, symbol] of replacementSymbols.entries()) {
        if (symbol.char === '[') {
            branchDepth += 1;
            continue;
        }

        if (symbol.char === ']') {
            branchDepth = Math.max(0, branchDepth - 1);
            continue;
        }

        if (getCarryOverGroup(symbol.char) !== carryOverGroup) {
            continue;
        }

        fallbackMatches.push(index);
        if (branchDepth === 0) {
            depthZeroMatches.push(index);
        }
    }

    const targetIndices = depthZeroMatches.length
        ? depthZeroMatches
        : fallbackMatches;
    if (targetIndices.length === 0) {
        return replacementSymbols;
    }

    const totalTargetWeight = targetIndices.reduce((sum, index) => {
        return sum + getSymbolSizeWeight(replacementSymbols[index]);
    }, 0);
    if (totalTargetWeight <= 0) {
        return replacementSymbols;
    }

    const inheritedGrowthStart =
        getSymbolSizeWeight(sourceSymbol) / totalTargetWeight;
    const targetIndexSet = new Set(targetIndices);

    return replacementSymbols.map((symbol, index) =>
        targetIndexSet.has(index)
            ? { ...symbol, growthStart: inheritedGrowthStart }
            : symbol,
    );
}

export function parseLSystemSymbols(
    input: string,
    generation: number,
): LSystemSymbol[] {
    const symbols: LSystemSymbol[] = [];

    for (let index = 0; index < input.length; index++) {
        const char = input[index];
        if (/\s/.test(char)) {
            continue;
        }

        if (input[index + 1] === '(') {
            const closingIndex = input.indexOf(')', index + 2);
            if (closingIndex !== -1) {
                const params = parseSymbolParameters(
                    input.slice(index + 2, closingIndex),
                );

                symbols.push({
                    char,
                    generation,
                    ...(params ? { params } : {}),
                });
                index = closingIndex;
                continue;
            }
        }

        symbols.push({ char, generation });
    }

    return symbols;
}

function formatParameter(value: number) {
    return Number.isInteger(value)
        ? String(value)
        : String(Number(value.toFixed(3)));
}

export function serializeLSystemSymbol(symbol: LSystemSymbol) {
    if (!symbol.params?.length) {
        return symbol.char;
    }

    return `${symbol.char}(${symbol.params.map(formatParameter).join(',')})`;
}

export function serializeLSystemSymbols(symbols: LSystemSymbol[]) {
    return symbols.map(serializeLSystemSymbol).join('');
}

export function generateLSystemStringWithGenerations(
    axiom: string,
    rules: Record<string, Rule>,
    iterations: number,
    rng: SeededRNG,
): LSystemSymbol[] {
    if (iterations < 0) return [];
    let currentString = parseLSystemSymbols(axiom, 0);

    for (let i = 0; i < iterations; i++) {
        const nextString: LSystemSymbol[] = [];
        for (const [index, symbol] of currentString.entries()) {
            const ruleSet = rules[symbol.char];
            if (ruleSet) {
                let chosenRule: string;
                if (typeof ruleSet === 'string') {
                    chosenRule = ruleSet;
                } else {
                    const contextualRules = ruleSet.filter(
                        (rule) =>
                            hasContext(rule) &&
                            matchesContext(rule, currentString, index),
                    );
                    const genericRules = ruleSet.filter(
                        (rule) => !hasContext(rule),
                    );
                    const matchingRules =
                        contextualRules.length > 0
                            ? contextualRules
                            : genericRules;
                    if (matchingRules.length === 0) {
                        nextString.push(symbol);
                        continue;
                    }
                    chosenRule = chooseWeightedRule(matchingRules, rng);
                }
                nextString.push(
                    ...applyInheritedGrowthStart(
                        symbol,
                        parseLSystemSymbols(chosenRule, i + 1),
                    ),
                );
            } else {
                nextString.push(symbol);
            }
        }
        currentString = nextString;
    }
    return currentString;
}
