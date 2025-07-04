export type EntityStandardized = {
    id: number;
    information?: {
        name?: string;
        label?: string;
        shortDescription?: string;
        description?: string;

        // Parent items
        plant?: EntityStandardized;
    };
    attributes?: {
        seedingDistance?: number; // in cm
    },
    images?: {
        cover?: { url?: string };
    },
    image?: {
        cover?: { url?: string };
    };
    prices?: {
        perPlant?: number;
        perOperation?: number;
    };
}