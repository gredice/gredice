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
        alternativeName?: string[];
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
    relationships?: {
        companions?: EntityRelationshipSummary[];
        antagonists?: EntityRelationshipSummary[];
    };
    health?: {
        diseases?: EntityHealthIssueSummary[];
        pests?: EntityHealthIssueSummary[];
    };
    prices?: {
        perPlant?: number;
        perOperation?: number;
        discountDescription?: string | null;
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

export type EntityHealthOperationSummary = {
    id: number;
    slug: string;
    name: string;
    label?: string;
};

export type EntityHealthIssueSummary = {
    id: number;
    slug: string;
    name: string;
    kind: 'disease' | 'pest';
    shortDescription?: string;
    symptoms?: string;
    conditions?: string;
    image?: {
        cover?: { url?: string };
    };
    operations?: {
        prevention?: EntityHealthOperationSummary[];
        reduction?: EntityHealthOperationSummary[];
        alleviation?: EntityHealthOperationSummary[];
    };
};
