import {
    defaultSupportDefinition,
    defaultThornDefinition,
    type PlantDefinition,
} from '../plant-definition-types';

const HEIGHT_SCALE = 0.88;
const STEM_RADIUS_SCALE = 0.82;
const STEM_LENGTH_SCALE = 0.88;
const LEAF_SIZE_SCALE = 0.82;
const FLOWER_SIZE_SCALE = 0.84;
const PRODUCE_SIZE_SCALE = 0.82;
const STEM_MIN_RADIUS_SCALE = 0.82;
const THORN_SIZE_SCALE = 0.82;
const SUPPORT_HEIGHT_SCALE = 0.88;
const SUPPORT_WIDTH_SCALE = 0.88;
const SUPPORT_RADIUS_SCALE = 0.82;

function round(value: number) {
    return Math.round(value * 1000) / 1000;
}

export function createPlant(definition: PlantDefinition): PlantDefinition {
    const thorn = {
        ...defaultThornDefinition,
        ...definition.thorn,
    };
    const support = {
        ...defaultSupportDefinition,
        ...definition.support,
    };

    return {
        ...definition,
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
        support: {
            ...support,
            height: round(support.height * SUPPORT_HEIGHT_SCALE),
            radius: round(support.radius * SUPPORT_RADIUS_SCALE),
            width: round(support.width * SUPPORT_WIDTH_SCALE),
            depth: round(support.depth * SUPPORT_RADIUS_SCALE),
        },
    };
}
