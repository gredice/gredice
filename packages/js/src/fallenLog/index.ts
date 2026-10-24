export const fallenLog = {
    name: 'FallenLog',
    information: {
        label: 'Palo deblo s mahovinom',
        shortDescription:
            'Nisko drveno deblo sa svijetlim presjecima i malom plohom mahovine.',
        fullDescription:
            'Položeno deblo oblikuje šumski kutak uz drvo, kamen ili ukrasne gljive. Zauzima dva susjedna polja, a okretanjem se mijenja njegov smjer. Služi kao ukras, ne proizvodi drvo i ne utječe na rast biljaka. Na njega se ne mogu slagati drugi predmeti.',
    },
    attributes: {
        type: 'decoration',
        height: 0.45,
        hitboxHeight: 0.45,
        hitboxWidth: 1.9,
        hitboxDepth: 0.9,
        spanWidth: 2,
        spanDepth: 1,
        stackable: false,
        placeableOnWater: false,
        nightOnlyPurchase: false,
    },
    sunflowers: 55,
} satisfies {
    name: 'FallenLog';
    information: Record<string, string>;
    attributes: Record<string, string | number | boolean>;
    sunflowers: number;
};
