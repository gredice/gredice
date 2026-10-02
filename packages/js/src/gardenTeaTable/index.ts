export const gardenTeaTable = {
    name: 'GardenTeaTable',
    information: {
        label: 'Vrtni stolić s čajem',
        shortDescription:
            'Drveni stolić s termosicom i dvije emajlirane šalice toplog čaja.',
        fullDescription:
            'Mali drveni stolić s termosicom i dvije šalice stvara ugodan kutak za predah. Stolić i posuđe čine jedan ukras koji zauzima jedno polje. Posuđe se ne premješta zasebno. Na stolić se ne mogu slagati drugi predmeti.',
    },
    attributes: {
        type: 'decoration',
        height: 1,
        hitboxHeight: 1,
        hitboxWidth: 0.9,
        hitboxDepth: 0.9,
        spanWidth: 1,
        spanDepth: 1,
        stackable: false,
        placeableOnWater: false,
        nightOnlyPurchase: false,
    },
    sunflowers: 70,
} satisfies {
    name: 'GardenTeaTable';
    information: Record<string, string>;
    attributes: Record<string, string | number | boolean>;
    sunflowers: number;
};

/** Base-centred Y-up anchors above the authored mug rims for localized steam. */
export const gardenTeaTableMugAnchors: {
    id: string;
    position: [number, number, number];
    radius: number;
}[] = [
    { id: 'left', position: [-0.2, 0.8072, 0.13], radius: 0.035 },
    { id: 'right', position: [0.2, 0.8072, 0.03], radius: 0.035 },
];
