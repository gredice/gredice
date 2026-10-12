const variants = [
    {
        name: 'AutumnGrassTuft',
        label: 'niski zlatni busen',
        price: 30,
        height: 0.35,
    },
    { name: 'AutumnSeedHeads', label: 'klasovi', price: 40, height: 0.7 },
] satisfies {
    name: 'AutumnGrassTuft' | 'AutumnSeedHeads';
    label: string;
    price: number;
    height: number;
}[];

export const autumnGrasses = variants.map((variant) => ({
    name: variant.name,
    information: {
        label: `Ukrasne jesenske trave – ${variant.label}`,
        shortDescription:
            'Skupina zlatnih ukrasnih trava na maloj šljunčanoj podlozi.',
        fullDescription:
            'Uredno oblikovan busen ukrasnih trava zauzima jedno polje i ostaje zlatne boje tijekom cijele godine. Nije korov, usjev ni znak stanja biljaka. Ne mijenja rast ni izgled usjeva i ne daje sjeme. Na njega se ne slažu drugi predmeti.',
    },
    attributes: {
        type: 'decoration',
        height: variant.height,
        hitboxHeight: variant.height,
        hitboxWidth: 0.9,
        hitboxDepth: 0.9,
        spanWidth: 1,
        spanDepth: 1,
        stackable: false,
        placeableOnWater: false,
        nightOnlyPurchase: false,
    },
    sunflowers: variant.price,
}));

export const autumnGrassNames = autumnGrasses.map((item) => item.name);
export function getAutumnGrass(name: string) {
    return autumnGrasses.find((item) => item.name === name);
}

/** Static base-centred Y-up selection points on the gravel, independent of later sway. */
export const autumnGrassSelectionAnchors = {
    AutumnGrassTuft: [0, 0.031, 0],
    AutumnSeedHeads: [0, 0.031, 0],
} satisfies Record<(typeof variants)[number]['name'], [number, number, number]>;

/** #4981 owns motion. Keep the gravel fixed and any foliage displacement within this reserve. */
export const autumnGrassWind = {
    rootHeight: 0.033,
    maxDisplacement: 0.04,
    roots: [
        [-0.1, 0.033, 0.09],
        [0.12, 0.033, 0.025],
        [-0.01, 0.033, -0.13],
    ] satisfies [number, number, number][],
};
