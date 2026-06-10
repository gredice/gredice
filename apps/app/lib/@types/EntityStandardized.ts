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
        duration?: number | string;
        application?: string; // farm, garden, raisedBedFull, raisedBed1m, plant
    };
    images?: {
        cover?: { url?: string };
    };
    image?: {
        cover?: { url?: string };
    };
    relationships?: {
        companions?: EntityRelationshipSummary[];
        antagonists?: EntityRelationshipSummary[];
    };
    prices?: {
        perPlant?: number;
        perOperation?: number;
    };
    conditions?: {
        completionAttachImages?: boolean;
        completionAttachImagesRequired?: boolean;
        completionAttachNotes?: boolean;
        completionAttachNotesRequired?: boolean;
    };
};

export type EntityRelationshipSummary = {
    id: number;
    slug: string;
    name: string;
    latinName?: string;
    image?: {
        cover?: { url?: string };
    };
    relationship: 'companion' | 'antagonist';
};
