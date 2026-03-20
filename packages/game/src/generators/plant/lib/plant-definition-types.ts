/**
 * Shared types and constants for procedural plant presets.
 */

export type VegetableType =
    | 'strawberry'
    | 'blueberry'
    | 'raspberry'
    | 'tomato'
    | 'cucumber'
    | 'bellpepper'
    | 'carrot'
    | 'onion'
    | 'eggplant'
    | 'zucchini'
    | 'pumpkin'
    | 'melon'
    | 'beet'
    | 'radish'
    | 'turnip'
    | 'garlic'
    | 'leek'
    | 'broccoli'
    | 'cauliflower'
    | 'cabbage'
    | 'beanpod'
    | 'peapod'
    | 'artichoke'
    | 'okra'
    | 'fennel'
    | 'kohlrabi';

export interface RuleOption {
    rule: string;
    weight: number;
    left?: string[];
    right?: string[];
    ignore?: string[];
}

export type Rule = string | RuleOption[];

export interface ThornDefinition {
    enabled: boolean;
    color: string;
    size: number;
    density: number;
}

export const defaultThornDefinition: ThornDefinition = {
    enabled: false,
    color: '#8c6a3d',
    size: 0.08,
    density: 2,
};

export interface PlantDefinition {
    name: string;
    axiom: string;
    rules: Record<string, Rule>;
    angle: number;
    height: number;
    branching: number;
    directionVariability: number;
    stem: {
        color: string;
        radius: number;
        length: number;
        radiusDecay: number;
        minRadius: number;
        surface?: 'smooth' | 'bark';
        detailColor?: string;
        detailStrength?: number;
        detailScale?: number;
    };
    leaf: {
        color: string;
        size: number;
        type: 'round' | 'oval' | 'heart' | 'serrated' | 'compound';
        density: number;
        hangAngle: number;
        hangAngleRandomness: number;
        sizeDecay: number;
    };
    flower: {
        enabled: boolean;
        ageStart: number;
        color: string;
        size: number;
    };
    vegetable: {
        enabled: boolean;
        ageStart: number;
        type: VegetableType;
        yield: number;
        baseSize: number;
    };
    thorn?: ThornDefinition;
}

export const TERMINAL_STEM_SYMBOL = 'G';
export const TERMINAL_LEAF_SYMBOL = 'J';

export function isStemSymbol(char: string) {
    return char === 'F' || char === 'S' || char === TERMINAL_STEM_SYMBOL;
}

export function isLeafSymbol(char: string) {
    return char === 'L' || char === TERMINAL_LEAF_SYMBOL;
}

export const MAX_PLANT_GENERATION = 12;

export const vegetableTypeOptions: { value: VegetableType; label: string }[] = [
    { value: 'strawberry', label: 'Jagoda' },
    { value: 'blueberry', label: 'Borovnica' },
    { value: 'raspberry', label: 'Malina' },
    { value: 'tomato', label: 'Rajčica' },
    { value: 'cucumber', label: 'Krastavac' },
    { value: 'bellpepper', label: 'Paprika' },
    { value: 'carrot', label: 'Mrkva' },
    { value: 'onion', label: 'Luk' },
    { value: 'eggplant', label: 'Patliđan' },
    { value: 'zucchini', label: 'Tikvice' },
    { value: 'pumpkin', label: 'Tikva' },
    { value: 'melon', label: 'Dinja' },
    { value: 'beet', label: 'Cikla' },
    { value: 'radish', label: 'Rotkvica' },
    { value: 'turnip', label: 'Repa' },
    { value: 'garlic', label: 'Češnjak' },
    { value: 'leek', label: 'Poriluk' },
    { value: 'broccoli', label: 'Brokula' },
    { value: 'cauliflower', label: 'Cvjetača' },
    { value: 'cabbage', label: 'Kupus' },
    { value: 'beanpod', label: 'Mahuna' },
    { value: 'peapod', label: 'Grašak' },
    { value: 'artichoke', label: 'Artičoka' },
    { value: 'okra', label: 'Bamija' },
    { value: 'fennel', label: 'Komorač' },
    { value: 'kohlrabi', label: 'Koraba' },
];
