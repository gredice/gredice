export const autumnBlanketBench = {
    name: 'AutumnBlanketBench',
    information: {
        label: 'Drvena klupa s jesenskom dekom',
        shortDescription:
            'Drvena klupa s presavijenom krem dekom i prugama u boji hrđe.',
        fullDescription:
            'Jesenska klupa s mekom dekom stvara mali kutak za odmor. Zauzima dva susjedna polja kako bi drvo i prebačena deka ostali unutar prostora za postavljanje. Zaseban je ukras i ne mijenja postojeću drvenu klupu. Na nju se ne mogu slagati drugi predmeti.',
    },
    attributes: {
        type: 'decoration',
        height: 0.45,
        hitboxHeight: 0.45,
        hitboxWidth: 1.2,
        hitboxDepth: 0.5,
        spanWidth: 2,
        spanDepth: 1,
        stackable: false,
        placeableOnWater: false,
        nightOnlyPurchase: false,
    },
    sunflowers: 80,
} satisfies {
    name: 'AutumnBlanketBench';
    information: Record<string, string>;
    attributes: Record<string, string | number | boolean>;
    sunflowers: number;
};
