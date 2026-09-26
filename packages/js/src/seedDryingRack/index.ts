export const seedDryingRack = {
    name: 'SeedDryingRack',
    information: {
        label: 'Ukrasni stalak za sušenje sjemena',
        shortDescription:
            'Mali drveni stalak s dvije plitice i širokim visećim klasovima.',
        fullDescription:
            'Drveni stalak s pliticama i suhim klasovima ukrašava jedno polje vrta. Predmet je samo ukras: ne pohranjuje, ne suši i ne daje sjeme, ne mijenja zalihu sjemena i ne donosi nagrade. Na njega se ne slažu drugi predmeti.',
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
    sunflowers: 60,
} satisfies {
    name: 'SeedDryingRack';
    information: Record<string, string>;
    attributes: Record<string, string | number | boolean>;
    sunflowers: number;
};
