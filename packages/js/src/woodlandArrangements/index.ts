const variants = [
    { name: 'WoodlandAcorns', label: 'žirevi', price: 25, height: 0.35 },
    {
        name: 'WoodlandConkers',
        label: 'divlji kesteni',
        price: 25,
        height: 0.25,
    },
    {
        name: 'WoodlandMushroomBasket',
        label: 'košarica s gljivama',
        price: 45,
        height: 0.65,
    },
] satisfies {
    name: 'WoodlandAcorns' | 'WoodlandConkers' | 'WoodlandMushroomBasket';
    label: string;
    price: number;
    height: number;
}[];

export const woodlandArrangements = variants.map((variant) => ({
    name: variant.name,
    information: {
        label: `Šumski ukras – ${variant.label}`,
        shortDescription: 'Pažljivo složen šumski motiv naglašenih oblika.',
        fullDescription:
            'Skupina šumskih motiva zauzima jedno polje i ostaje na odabranom mjestu tijekom cijele godine. Predmet je samo ukras, ne predstavlja jestivu vrstu ni savjet za branje i ne daje plodove, gljive ili druge resurse. Na njega se ne slažu drugi predmeti.',
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

export const woodlandArrangementNames = woodlandArrangements.map(
    (item) => item.name,
);
export function getWoodlandArrangement(name: string) {
    return woodlandArrangements.find((item) => item.name === name);
}

/** Base-centred Y-up origins for a later observation activity; no actions registered. */
export const woodlandObservationAnchors = {
    WoodlandAcorns: [0, 0.34, -0.13],
    WoodlandConkers: [-0.02, 0.235, -0.13],
    WoodlandMushroomBasket: [0, 0.49, -0.13],
} satisfies Record<(typeof variants)[number]['name'], [number, number, number]>;
/** Stable real-geometry picking points, independent of future observation UI. */
export const woodlandSelectionAnchors = {
    WoodlandAcorns: [0, 0.027, 0],
    WoodlandConkers: [0, 0.027, 0],
    WoodlandMushroomBasket: [0, 0.62, 0],
} satisfies Record<(typeof variants)[number]['name'], [number, number, number]>;
