export const horseCatalogPriceSunflowers = '500';

export const horseBlockAttributes = {
    'attributes.height': '1.46',
    'attributes.hitboxDepth': '1.86',
    'attributes.hitboxHeight': '1.46',
    'attributes.hitboxWidth': '0.76',
    'attributes.nightOnlyPurchase': 'false',
    'attributes.placeableOnWater': 'false',
    'attributes.spanDepth': '2',
    'attributes.spanWidth': '1',
    'attributes.stackable': 'false',
    'attributes.type': 'decoration',
    'functions.raisedBed': 'false',
    'functions.recycler': 'false',
    'image.cover': JSON.stringify({
        url: 'https://www.gredice.com/assets/blocks/Horse.webp',
    }),
    'information.fullDescription':
        'Smjesti konja u vrt, odaberi mu boju dlake i gledaj kako mirno pase, osluškuje okolinu te polako obilazi prohodne staze. Kad ima dovoljno prostora, nakratko prelazi u kas, ali ostaje oprezan uz gredice, ograde i druge prepreke.',
    'information.label': 'Konj',
    'information.name': 'Horse',
    'information.shortDescription':
        'Miran vrtni konj koji pase i polako obilazi slobodne staze.',
    // All existing Ljubimci catalogue entries cost 500 sunflowers. Matching
    // that established pet price keeps the directly placeable horse legible
    // as part of the same category without introducing an arbitrary premium.
    'prices.sunflowers': horseCatalogPriceSunflowers,
} satisfies Record<string, string>;

export function parseHorseCatalogOptions(argv: string[]) {
    for (const argument of argv) {
        if (argument !== '--' && argument !== '--apply') {
            throw new Error(`Unknown argument: ${argument}`);
        }
    }
    return { apply: argv.includes('--apply') };
}
