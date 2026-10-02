const variants = [
    { name: 'AutumnLeafPileMound', label: 'niska hrpa', price: 25 },
    { name: 'AutumnLeafPileCrescent', label: 'pometeni polumjesec', price: 30 },
] satisfies {
    name: 'AutumnLeafPileMound' | 'AutumnLeafPileCrescent';
    label: string;
    price: number;
}[];

export const autumnLeafPiles = variants.map((variant) => ({
    name: variant.name,
    information: {
        label: `Ukrasno jesensko lišće – ${variant.label}`,
        shortDescription:
            'Nizak ukras od širokih bakrenih, zlatnih i smeđih listova.',
        fullDescription:
            'Ukrasna hrpa lišća zauzima jedno polje i ostaje na odabranom mjestu tijekom svih godišnjih doba. Kiša je može potamniti, a snijeg prekriti, ali je ne uklanjaju. Nije prirodno nakupljeno lišće i ne naručuje radove u vrtu. Na nju se ne mogu slagati drugi predmeti.',
    },
    attributes: {
        type: 'decoration',
        height: 0.18,
        hitboxHeight: 0.18,
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

export const autumnLeafPileNames = autumnLeafPiles.map((item) => item.name);
export function getAutumnLeafPile(name: string) {
    return autumnLeafPiles.find((item) => item.name === name);
}

// Stable Y-up model-local anchors reserved for the later cosmetic activity (#4995).
// The entity group supplies placement height and rotation; these create no action.
export const autumnLeafPileInteractionAnchors = {
    AutumnLeafPileMound: [0, 0.1, 0],
    AutumnLeafPileCrescent: [0.24, 0.1, 0],
} satisfies Record<(typeof variants)[number]['name'], [number, number, number]>;
