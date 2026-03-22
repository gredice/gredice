import { parseLSystemSymbols, serializeLSystemSymbols } from '../l-system';
import {
    defaultThornDefinition,
    isLeafSymbol,
    isStemSymbol,
    type PlantDefinition,
    type Rule,
    TERMINAL_LEAF_SYMBOL,
    TERMINAL_STEM_SYMBOL,
} from '../plant-definition-types';

const HEIGHT_SCALE = 0.88;
const STEM_RADIUS_SCALE = 0.82;
const STEM_LENGTH_SCALE = 0.88;
const LEAF_SIZE_SCALE = 0.82;
const FLOWER_SIZE_SCALE = 0.84;
const PRODUCE_SIZE_SCALE = 0.82;
const STEM_MIN_RADIUS_SCALE = 0.82;
const THORN_SIZE_SCALE = 0.82;

function round(value: number) {
    return Math.round(value * 1000) / 1000;
}

function isMatchingGrowthGroup(group: 'leaf' | 'stem', symbol: string) {
    return group === 'stem' ? isStemSymbol(symbol) : isLeafSymbol(symbol);
}

function getTerminalGrowthSymbol(group: 'leaf' | 'stem') {
    return group === 'stem' ? TERMINAL_STEM_SYMBOL : TERMINAL_LEAF_SYMBOL;
}

function findRetainedGrowthIndex(
    symbols: ReturnType<typeof parseLSystemSymbols>,
    group: 'leaf' | 'stem',
) {
    let branchDepth = 0;
    const candidateIndices: number[] = [];
    const depthZeroCandidateIndices: number[] = [];

    for (const [index, symbol] of symbols.entries()) {
        if (symbol.char === '[') {
            branchDepth += 1;
            continue;
        }

        if (symbol.char === ']') {
            branchDepth = Math.max(0, branchDepth - 1);
            continue;
        }

        if (!isMatchingGrowthGroup(group, symbol.char)) {
            continue;
        }

        candidateIndices.push(index);
        if (branchDepth === 0) {
            depthZeroCandidateIndices.push(index);
        }
    }

    return (
        depthZeroCandidateIndices[depthZeroCandidateIndices.length - 1] ??
        candidateIndices[candidateIndices.length - 1]
    );
}

function linearizeGrowthGroup(
    symbols: ReturnType<typeof parseLSystemSymbols>,
    group: 'leaf' | 'stem',
    retainedIndex: number | undefined,
) {
    const terminalGrowthSymbol = getTerminalGrowthSymbol(group);

    return symbols.map((symbol, index) => {
        if (
            index === retainedIndex ||
            !isMatchingGrowthGroup(group, symbol.char)
        ) {
            return symbol;
        }

        return {
            ...symbol,
            char: terminalGrowthSymbol,
        };
    });
}

function linearizeRuleString(sourceSymbol: string, rule: string) {
    const parsedSymbols = parseLSystemSymbols(rule, 0);
    const retainedStemIndex =
        sourceSymbol === 'F' || sourceSymbol === 'S'
            ? findRetainedGrowthIndex(parsedSymbols, 'stem')
            : undefined;
    const stemLinearizedSymbols = linearizeGrowthGroup(
        parsedSymbols,
        'stem',
        retainedStemIndex,
    );
    const retainedLeafIndex = findRetainedGrowthIndex(
        stemLinearizedSymbols,
        'leaf',
    );

    return serializeLSystemSymbols(
        linearizeGrowthGroup(stemLinearizedSymbols, 'leaf', retainedLeafIndex),
    );
}

function linearizeRule(sourceSymbol: string, rule: Rule): Rule {
    if (typeof rule === 'string') {
        return linearizeRuleString(sourceSymbol, rule);
    }

    return rule.map((option) => ({
        ...option,
        rule: linearizeRuleString(sourceSymbol, option.rule),
    }));
}

function linearizeRules(rules: PlantDefinition['rules']) {
    const linearizedRules: PlantDefinition['rules'] = {};

    for (const [symbol, rule] of Object.entries(rules)) {
        linearizedRules[symbol] = linearizeRule(symbol, rule);
    }

    return linearizedRules;
}

export function createPlant(definition: PlantDefinition): PlantDefinition {
    const thorn = {
        ...defaultThornDefinition,
        ...definition.thorn,
    };

    return {
        ...definition,
        rules: linearizeRules(definition.rules),
        height: round(definition.height * HEIGHT_SCALE),
        stem: {
            ...definition.stem,
            radius: round(definition.stem.radius * STEM_RADIUS_SCALE),
            length: round(definition.stem.length * STEM_LENGTH_SCALE),
            minRadius: round(definition.stem.minRadius * STEM_MIN_RADIUS_SCALE),
        },
        leaf: {
            ...definition.leaf,
            size: round(definition.leaf.size * LEAF_SIZE_SCALE),
        },
        flower: {
            ...definition.flower,
            size: round(definition.flower.size * FLOWER_SIZE_SCALE),
        },
        vegetable: {
            ...definition.vegetable,
            baseSize: round(definition.vegetable.baseSize * PRODUCE_SIZE_SCALE),
        },
        thorn: {
            ...thorn,
            size: round(thorn.size * THORN_SIZE_SCALE),
        },
    };
}
