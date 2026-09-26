const variants = [
    {
        name: 'AutumnWreathPost',
        label: 'vijenac na stupu',
        price: 45,
        height: 1.05,
        width: 0.9,
    },
    {
        name: 'AutumnGarland',
        label: 'girlanda na nosačima',
        price: 55,
        height: 0.95,
        width: 0.9,
    },
    {
        name: 'AutumnFenceGate',
        label: 'vrata s bundevama',
        price: 75,
        height: 0.8,
        width: 1.05,
    },
] satisfies {
    name: 'AutumnWreathPost' | 'AutumnGarland' | 'AutumnFenceGate';
    label: string;
    price: number;
    height: number;
    width: number;
}[];

export const autumnEntrances = variants.map((variant) => ({
    name: variant.name,
    information: {
        label: `Jesenski ulaz – ${variant.label}`,
        shortDescription: 'Jesenski ukras na vlastitim drvenim nosačima.',
        fullDescription:
            'Jesenski detalj s vlastitim nosačima zauzima jedno polje. Vijenac i girlanda služe kao ukras, a vrata s bundevama otvaraju se dodirom i povezuju s ogradom. Ukrasi ne daju resurse ni nagrade. Na njih se ne slažu drugi predmeti.',
    },
    attributes: {
        type: 'decoration',
        height: variant.height,
        hitboxHeight: variant.height,
        hitboxWidth: variant.width,
        hitboxDepth: variant.width,
        spanWidth: 1,
        spanDepth: 1,
        stackable: false,
        placeableOnWater: false,
        nightOnlyPurchase: false,
    },
    sunflowers: variant.price,
}));

export const autumnEntranceNames = autumnEntrances.map((item) => item.name);
export function getAutumnEntrance(name: string) {
    return autumnEntrances.find((item) => item.name === name);
}

/** Dormant Y-up sway origins for #4981. Supports and the gate remain fixed. */
export const autumnEntranceSway = {
    AutumnWreathPost: { roots: [[0, 0.73, -0.07]], maxDisplacement: 0.025 },
    AutumnGarland: {
        roots: [
            [-0.34, 0.84, -0.07],
            [0.34, 0.84, -0.07],
        ],
        maxDisplacement: 0.025,
    },
} satisfies Record<
    string,
    { roots: [number, number, number][]; maxDisplacement: number }
>;
