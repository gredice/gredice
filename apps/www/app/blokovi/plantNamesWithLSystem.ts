/**
 * Mapping of normalized Croatian plant names to L-system plant type keys.
 * This is a lightweight mirror of inGamePlantRuntimeConfigs aliases,
 * kept separate to avoid importing the heavy game package in gallery components.
 */
const plantNameToType: Record<string, string> = {
    jagoda: 'strawberry',
    borovnica: 'blueberry',
    malina: 'raspberry',
    rajčica: 'tomato',
    paprika: 'bellpepper',
    patlidžan: 'eggplant',
    artičoka: 'artichoke',
    bamija: 'okra',
    krastavac: 'cucumber',
    tikvice: 'zucchini',
    tikva: 'pumpkin',
    dinja: 'melon',
    mrkva: 'carrot',
    cikla: 'beet',
    rotkvica: 'radish',
    repa: 'turnip',
    luk: 'onion',
    češnjak: 'garlic',
    poriluk: 'leek',
    'luk vlasac': 'chives',
    blitva: 'swisschard',
    celer: 'celery',
    salata: 'lettuce',
    špinat: 'spinach',
    rukola: 'arugula',
    matovilac: 'mache',
    bosiljak: 'basil',
    kopar: 'dill',
    korijandar: 'coriander',
    ljupčac: 'lovage',
    origano: 'oregano',
    peršin: 'parsley',
    timijan: 'thyme',
    bob: 'broadbean',
    grah: 'bean',
    grašak: 'pea',
    mahuna: 'greenbean',
    brokula: 'broccoli',
    cvjetača: 'cauliflower',
    kelj: 'kale',
    koraba: 'kohlrabi',
    kupus: 'cabbage',
    raštika: 'collard',
    komorač: 'fennel',
    'limunska trava': 'lemongrass',
    'pšenična trava': 'wheatgrass',
    'ukrasna trava': 'ornamentalgrass',
    smokva: 'figtree',
    maslina: 'olivetree',
    'mlada jabuka': 'youngappletree',
};

/** Set of lowercase plant names that have L-system models. */
export const plantNamesWithLSystem = new Set(Object.keys(plantNameToType));

/** Resolve a plant name (Croatian) to an L-system plant type key. */
export function resolvePlantType(name: string): string | null {
    const lower = name.toLowerCase();
    return plantNameToType[lower] ?? null;
}
