export const woodlandMushrooms = {
    name: 'WoodlandMushrooms',
    information: {
        label: 'Ukrasne šumske gljive',
        shortDescription:
            'Skupina pet zdepastih gljiva sa smeđim i krem klobucima.',
        fullDescription:
            'Pet ukrasnih gljiva različitih visina čini mali šumski kutak uz drvo, panj ili kamen. Skupina zauzima jedno polje i ostaje isti ukras tijekom cijele godine. Nije usjev, ne bere se i ne utječe na rast biljaka.',
    },
    attributes: {
        type: 'decoration',
        height: 0.4,
        hitboxHeight: 0.4,
        hitboxWidth: 0.9,
        hitboxDepth: 0.9,
        spanWidth: 1,
        spanDepth: 1,
        stackable: false,
        placeableOnWater: false,
        nightOnlyPurchase: false,
    },
    sunflowers: 35,
} satisfies {
    name: 'WoodlandMushrooms';
    information: Record<string, string>;
    attributes: Record<string, string | number | boolean>;
    sunflowers: number;
};
