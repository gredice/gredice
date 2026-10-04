export const gardenScarecrow = {
    name: 'GardenScarecrow',
    information: {
        label: 'Vrtno strašilo',
        shortDescription:
            'Vedro strašilo sa slamnatim šeširom, plavom košuljom i rukama od grančica.',
        fullDescription:
            'Malo vrtno strašilo s nakrivljenim slamnatim šeširom i zakrpama na plavoj košulji. Postavi ga iza gredice ili uz stazu, tako da biljke ostanu na vidiku. Zauzima jedno polje. Služi samo za ukrašavanje: ne štiti od nametnika i ne utječe na urod.',
    },
    attributes: {
        type: 'decoration',
        height: 1.41,
        hitboxHeight: 1.41,
        hitboxWidth: 0.86,
        hitboxDepth: 0.42,
        spanWidth: 1,
        spanDepth: 1,
        stackable: false,
        placeableOnWater: false,
        nightOnlyPurchase: false,
    },
    sunflowers: 80,
} satisfies {
    name: 'GardenScarecrow';
    information: Record<string, string>;
    attributes: Record<string, string | number | boolean>;
    sunflowers: number;
};
