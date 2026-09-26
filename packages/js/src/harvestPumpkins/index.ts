// Fixed catalogue identities: saved blocks and covers never depend on a random
// colour, crop-growth state, or the contents of a functional harvest basket.
const shapes = [
    {
        asset: 'HarvestPumpkinSquat',
        label: 'Ukrasna bundeva',
        description: 'Niska, rebrasta bundeva sa savijenom peteljkom.',
        height: 0.42,
        hitboxWidth: 0.72,
        hitboxDepth: 0.72,
        sunflowers: 30,
    },
    {
        asset: 'HarvestPumpkinGourd',
        label: 'Ukrasna tikvica',
        description: 'Kruškolika tikvica s izduženim, blago savijenim vratom.',
        height: 0.55,
        hitboxWidth: 0.5,
        hitboxDepth: 0.5,
        sunflowers: 30,
    },
    {
        asset: 'HarvestPumpkinGroup',
        label: 'Skupina ukrasnih bundeva',
        description:
            'Tri rebraste bundeve različitih veličina u jednom malom ukrasu.',
        height: 0.41,
        hitboxWidth: 0.86,
        hitboxDepth: 0.88,
        sunflowers: 60,
    },
] satisfies {
    asset:
        | 'HarvestPumpkinSquat'
        | 'HarvestPumpkinGourd'
        | 'HarvestPumpkinGroup';
    label: string;
    description: string;
    height: number;
    hitboxWidth: number;
    hitboxDepth: number;
    sunflowers: number;
}[];

const colors = [
    { suffix: 'Orange', label: 'narančasta', hex: '#E08A3C' },
    { suffix: 'Cream', label: 'krem', hex: '#EEE3CB' },
    { suffix: 'Green', label: 'zelena', hex: '#7D8F68' },
] satisfies {
    suffix: 'Orange' | 'Cream' | 'Green';
    label: string;
    hex: string;
}[];

export const harvestPumpkins = shapes.flatMap((shape) =>
    colors.map((color) => {
        const name: `${typeof shape.asset}${typeof color.suffix}` = `${shape.asset}${color.suffix}`;
        return {
            name,
            asset: shape.asset,
            color: color.hex,
            information: {
                label: `${shape.label} – ${color.label}`,
                shortDescription: shape.description,
                fullDescription: `${shape.description} Ukras za jesenski kutak vrta, uvijek u odabranoj boji. Zauzima jedno polje. Služi samo za ukrašavanje i ne daje urod.`,
            },
            attributes: {
                type: 'decoration',
                height: shape.height,
                hitboxHeight: shape.height,
                hitboxWidth: shape.hitboxWidth,
                hitboxDepth: shape.hitboxDepth,
                spanWidth: 1,
                spanDepth: 1,
                stackable: false,
                placeableOnWater: false,
                nightOnlyPurchase: false,
            },
            sunflowers: shape.sunflowers,
        };
    }),
);

export const harvestPumpkinNames = harvestPumpkins.map((item) => item.name);

export function getHarvestPumpkin(name: string) {
    return harvestPumpkins.find((item) => item.name === name);
}
