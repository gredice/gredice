const colors = [
    { suffix: 'Mauve', label: 'ljubičasti', hex: '#9B709C', center: '#D6B83F' },
    { suffix: 'Cream', label: 'krem', hex: '#EEE3CB', center: '#D6B83F' },
    { suffix: 'Gold', label: 'zlatni', hex: '#D6B83F', center: '#965D30' },
] satisfies {
    suffix: 'Mauve' | 'Cream' | 'Gold';
    label: string;
    hex: string;
    center: string;
}[];

// Independent decoration identities preserve existing empty pots and crop purchases.
export const autumnAsterPots = colors.map((color) => {
    const name: `AutumnAsterPot${typeof color.suffix}` = `AutumnAsterPot${color.suffix}`;
    return {
        name,
        color: color.hex,
        centerColor: color.center,
        information: {
            label: `Ukrasni jesenski asteri – ${color.label}`,
            shortDescription:
                'Pet širokih cvjetova u niskoj posudi od terakote.',
            fullDescription: `Ukrasni jesenski asteri u niskoj posudi od terakote, uvijek u odabranoj boji. Zauzimaju jedno polje. Služe samo za ukrašavanje: ne siju se, ne rastu i ne daju urod. Nisu kupnja stvarne biljke.`,
        },
        attributes: {
            type: 'decoration',
            height: 0.61,
            hitboxHeight: 0.61,
            hitboxWidth: 0.72,
            hitboxDepth: 0.72,
            spanWidth: 1,
            spanDepth: 1,
            stackable: false,
            placeableOnWater: false,
            nightOnlyPurchase: false,
        },
        sunflowers: 45,
    };
});

export const autumnAsterPotNames = autumnAsterPots.map((item) => item.name);

export function getAutumnAsterPot(name: string) {
    return autumnAsterPots.find((item) => item.name === name);
}
