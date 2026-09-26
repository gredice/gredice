export const leafRake = {
    name: 'LeafRake',
    information: {
        label: 'Grablje s hrpom lišća',
        shortDescription:
            'Drvene grablje s tamnom lepezastom glavom naslonjene na malu hrpu lišća.',
        fullDescription:
            'Ukrasne grablje i hrpa jesenskog lišća čine jedan predmet koji zauzima jedno polje. Ostaju na mjestu tijekom cijele godine. Postavljanje ne naručuje niti potvrđuje obavljene radove u vrtu, ne utječe na biljke i ne donosi nagrade. Na predmet se ne mogu slagati drugi blokovi.',
    },
    attributes: {
        type: 'decoration',
        height: 1.1,
        hitboxHeight: 1.1,
        hitboxWidth: 0.9,
        hitboxDepth: 0.9,
        spanWidth: 1,
        spanDepth: 1,
        stackable: false,
        placeableOnWater: false,
        nightOnlyPurchase: false,
    },
    sunflowers: 45,
} satisfies {
    name: 'LeafRake';
    information: Record<string, string>;
    attributes: Record<string, string | number | boolean>;
    sunflowers: number;
};
