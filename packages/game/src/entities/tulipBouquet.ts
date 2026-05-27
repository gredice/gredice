type TulipBouquetVector = [number, number, number];

export type TulipBouquetStem = {
    key: string;
    position: TulipBouquetVector;
    rotation: TulipBouquetVector;
    scale: TulipBouquetVector;
};

export const tulipBouquetStems: TulipBouquetStem[] = [
    {
        key: 'tall-center',
        position: [-0.006, 0, -0.003],
        rotation: [0.02, -0.04, 0.03],
        scale: [1, 1.1, 1],
    },
    {
        key: 'left-front',
        position: [-0.026, 0, 0.015],
        rotation: [-0.14, 0.06, 0.2],
        scale: [0.97, 1.03, 0.97],
    },
    {
        key: 'right-mid',
        position: [0.024, 0, 0.004],
        rotation: [-0.09, 0.16, -0.23],
        scale: [0.93, 1.07, 0.93],
    },
    {
        key: 'back-left-short',
        position: [-0.017, 0, -0.025],
        rotation: [0.2, -0.18, 0.1],
        scale: [0.9, 1, 0.9],
    },
    {
        key: 'front-right-low',
        position: [0.011, 0, 0.029],
        rotation: [-0.22, -0.08, -0.08],
        scale: [0.95, 1.02, 0.95],
    },
];
