const variants = [
    { name: 'PumpkinLanternSmile', label: 'osmijeh' },
    { name: 'PumpkinLanternWink', label: 'namigivanje' },
] satisfies {
    name: 'PumpkinLanternSmile' | 'PumpkinLanternWink';
    label: string;
}[];
export const pumpkinLanterns = variants.map((variant) => ({
    name: variant.name,
    information: {
        label: `Bundeva svjetiljka – ${variant.label}`,
        shortDescription:
            'Izrezbarena rebrasta bundeva s toplim večernjim sjajem.',
        fullDescription:
            'Ukrasna bundeva s izrezbarenim licem zauzima jedno polje. Lice se uvečer nježno osvijetli, a danju ostaje vidljivo u izdubljenoj kori. Kupljena svjetiljka ostaje dostupna tijekom cijele godine, i nakon sezonskog događanja. Ne daje urod ni nagrade i na nju se ne slažu drugi predmeti.',
    },
    attributes: {
        type: 'decoration',
        height: 0.55,
        hitboxHeight: 0.55,
        hitboxWidth: 0.9,
        hitboxDepth: 0.9,
        spanWidth: 1,
        spanDepth: 1,
        stackable: false,
        placeableOnWater: false,
        nightOnlyPurchase: false,
    },
    sunflowers: 55,
}));
export const pumpkinLanternNames = pumpkinLanterns.map((item) => item.name);
export function getPumpkinLantern(name: string) {
    return pumpkinLanterns.find((item) => item.name === name);
}
