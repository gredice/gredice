import type { Rule } from './plant-definitions';
import type { SeededRNG } from './rng';

export interface LSystemSymbol {
    char: string;
    generation: number;
}

function chooseWeightedRule(
    rules: { rule: string; weight: number }[],
    rng: SeededRNG,
): string {
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

export function generateLSystemStringWithGenerations(
    axiom: string,
    rules: Record<string, Rule>,
    iterations: number,
    rng: SeededRNG,
): LSystemSymbol[] {
    if (iterations < 0) return [];
    let currentString: LSystemSymbol[] = axiom
        .split('')
        .map((char) => ({ char, generation: 0 }));

    for (let i = 0; i < iterations; i++) {
        const nextString: LSystemSymbol[] = [];
        for (const symbol of currentString) {
            const ruleSet = rules[symbol.char];
            if (ruleSet) {
                let chosenRule: string;
                if (typeof ruleSet === 'string') {
                    chosenRule = ruleSet;
                } else {
                    chosenRule = chooseWeightedRule(ruleSet, rng);
                }
                nextString.push(
                    ...chosenRule
                        .split('')
                        .map((char) => ({ char, generation: i + 1 })),
                );
            } else {
                nextString.push(symbol);
            }
        }
        currentString = nextString;
    }
    return currentString;
}
