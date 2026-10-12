export const stackedFirewood = {
    name: 'StackedFirewood',
    information: {
        label: 'Složena drva za ogrjev',
        shortDescription:
            'Niska i uredna hrpa cijepanih drva sa svijetlim presjecima.',
        fullDescription:
            'Šest komada cijepanog drva složeno je u nisku hrpu koja zauzima jedno polje. Svijetli presjeci i tamna kora ukrašavaju kutak uz klupu ili vrtnu svjetiljku. Drva su ukras: ne troše se, ne daju resurse i ne utječu na biljke. Na njih se ne slažu drugi predmeti.',
    },
    attributes: {
        type: 'decoration',
        height: 0.45,
        hitboxHeight: 0.45,
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
    name: 'StackedFirewood';
    information: Record<string, string>;
    attributes: Record<string, string | number | boolean>;
    sunflowers: number;
};
