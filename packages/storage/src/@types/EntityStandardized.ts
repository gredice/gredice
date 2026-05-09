export type EntityStandardized = {
    id: number;
    entityType?: {
        id: number;
        name: string;
        label: string;
    };
    information?: {
        name?: string;
        label?: string;
        shortDescription?: string;
        description?: string;
        instructions?: string;

        // Parent items
        plant?: EntityStandardized;
    };
    attributes?: {
        seedingDistance?: number; // in cm
        frequency?: string;
        application?: string;
        deliverable?: boolean;
        duration?: number;
        relativeDays?: number | null;
        stage?: {
            id: number;
            information: {
                name: string;
                label: string;
            };
        };
        [key: string]: unknown; // Allow other dynamic attributes
    };
    images?: {
        cover?: { url?: string };
    };
    image?: {
        cover?: { url?: string };
    };
    prices?: {
        perPlant?: number;
        perOperation?: number;
        discountDescription?: string | null;
    };
    conditions?: {
        completionAttachImages?: boolean;
        completionAttachImagesRequired?: boolean;
    };
};
