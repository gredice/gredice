export const birdFeeder = {
    name: 'BirdFeeder',
    information: {
        label: 'Ukrasna hranilica za ptice',
        shortDescription:
            'Otvorena osmerokutna plitica na čvrstom drvenom postolju.',
        fullDescription:
            'Mala otvorena hranilica zauzima jedno polje. Plitica i prečke razlikuju je od zatvorene kućice za ptice. Predmet je samo ukras: ne privlači niti stvara ptice, ne troši hranu i ne daje resurse. Na njega se ne slažu drugi predmeti.',
    },
    attributes: {
        type: 'decoration',
        height: 0.85,
        hitboxHeight: 0.85,
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
    name: 'BirdFeeder';
    information: Record<string, string>;
    attributes: Record<string, string | number | boolean>;
    sunflowers: number;
};
