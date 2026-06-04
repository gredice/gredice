export type PlantHealthOperation = {
    id: number;
    slug?: string | null;
    name: string;
};

export type PlantHealthIssue = {
    id: number;
    slug?: string | null;
    name: string;
    kind?: 'disease' | 'pest' | string | null;
    shortDescription?: string | null;
    symptoms?: string | null;
    conditions?: string | null;
    operations?: Partial<
        Record<
            'prevention' | 'reduction' | 'alleviation',
            PlantHealthOperation[] | null
        >
    > | null;
};

export type PlantHealth = {
    diseases?: PlantHealthIssue[] | null;
    pests?: PlantHealthIssue[] | null;
};

export type PlantHealthSource = {
    health?: PlantHealth | null;
};
