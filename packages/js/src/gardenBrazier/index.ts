export const gardenBrazier = {
    name: 'GardenBrazier',
    information: {
        label: 'Ukrasno vrtno ložište',
        shortDescription:
            'Malo metalno ložište na tri noge s oblim rubom i bočnim ručkama.',
        fullDescription:
            'Ukrasno ložište s nekoliko komada drva stvara kutak za večernji odmor. Zauzima jedno polje i može prikazivati ukrasni plamen uz uključene vremenske efekte. Ne grije vrt, ne štiti biljke od hladnoće i ne troši drva ni druge resurse. Na njega se ne slažu drugi predmeti.',
    },
    attributes: {
        type: 'decoration',
        height: 0.5,
        hitboxHeight: 0.5,
        hitboxWidth: 0.9,
        hitboxDepth: 0.9,
        spanWidth: 1,
        spanDepth: 1,
        stackable: false,
        placeableOnWater: false,
        nightOnlyPurchase: false,
    },
    sunflowers: 65,
} satisfies {
    name: 'GardenBrazier';
    information: Record<string, string>;
    attributes: Record<string, string | number | boolean>;
    sunflowers: number;
};

/** Base-centred Y-up anchors for the contained effects in #4980. */
export const gardenBrazierEffectAnchors: {
    id: string;
    position: [number, number, number];
    radius: number;
}[] = [
    { id: 'fire', position: [0, 0.395, 0], radius: 0.18 },
    { id: 'smoke', position: [0, 0.515, 0], radius: 0.14 },
    { id: 'sound', position: [0, 0.37, 0], radius: 0 },
];
