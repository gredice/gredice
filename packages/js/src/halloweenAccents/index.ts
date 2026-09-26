const variants = [
    {
        name: 'FriendlyGhost',
        label: 'Dobroćudni duh',
        sunflowers: 45,
        description:
            'Nasmiješeni duh od svijetlog platna na vlastitom drvenom stalku.',
    },
    {
        name: 'SupportedCobweb',
        label: 'Paučina na drvenom okviru',
        sunflowers: 30,
        description:
            'Sitna ukrasna paučina razapeta na vlastitom drvenom okviru.',
    },
] satisfies {
    name: 'FriendlyGhost' | 'SupportedCobweb';
    label: string;
    sunflowers: number;
    description: string;
}[];
export const halloweenAccents = variants.map((v) => ({
    name: v.name,
    information: {
        label: v.label,
        shortDescription: v.description,
        fullDescription:
            v.description +
            ' Zauzima jedno polje i ostaje dostupan tijekom cijele godine. Čisto ukrasni predmet ne mijenja urod niti privlači dodatne životinje. Na njega se ne slažu drugi predmeti.',
    },
    attributes: {
        type: 'decoration',
        nightOnlyPurchase: false,
        height: 1,
        hitboxHeight: 1,
        hitboxWidth: 0.9,
        hitboxDepth: 0.9,
        spanWidth: 1,
        spanDepth: 1,
        stackable: false,
        placeableOnWater: false,
    },
    sunflowers: v.sunflowers,
}));
export const halloweenAccentNames = halloweenAccents.map((v) => v.name);
export function getHalloweenAccent(name: string) {
    return halloweenAccents.find((v) => v.name === name);
}
