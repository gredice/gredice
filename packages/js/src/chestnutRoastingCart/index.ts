export const chestnutRoastingCart = {
    name: 'ChestnutRoastingCart',
    information: {
        label: 'Kolica s pečenim kestenima',
        shortDescription:
            'Kolica s pečenim kestenima s presavijenom krem dekom i prugama u boji hrđe.',
        fullDescription:
            'Mala kestenijada u vrtu: drvena kolica s pečenim kestenima, dva papirnata tuljca i natpis KESTENI čine jedan ukras. Zauzimaju dva susjedna polja. Ne proizvode hranu, ne griju vrt i ne utječu na biljke. Poslužni detalji ne premještaju se zasebno i na kolica se ne slažu drugi predmeti.',
    },
    attributes: {
        type: 'decoration',
        height: 1.45,
        hitboxHeight: 1.45,
        hitboxWidth: 1.6,
        hitboxDepth: 0.8,
        spanWidth: 2,
        spanDepth: 1,
        stackable: false,
        placeableOnWater: false,
        nightOnlyPurchase: false,
    },
    sunflowers: 110,
} satisfies {
    name: 'ChestnutRoastingCart';
    information: Record<string, string>;
    attributes: Record<string, string | number | boolean>;
    sunflowers: number;
};

/** Authored Y-up anchors, before runtime footprint offset/rotation. Effects belong to #4972/#4980. */
export const chestnutRoastingCartEffectAnchors: {
    id: string;
    position: [number, number, number];
    radius: number;
}[] = [
    { id: 'steam', position: [-0.275, 0.986, 0], radius: 0.16 },
    { id: 'fire', position: [-0.275, 0.6, 0], radius: 0.18 },
    { id: 'sound', position: [-0.275, 0.72, 0], radius: 0 },
];
