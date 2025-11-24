// Event data types for better type safety
export interface PlantUpdateEventData {
    status: 'sowed' | 'harvested';
    plantSortId?: string;
    [key: string]: unknown;
}

export interface EarnSunflowersEventData {
    reason: string;
    amount?: number;
    [key: string]: unknown;
}

// Generic event data union type
export type EventData =
    | PlantUpdateEventData
    | EarnSunflowersEventData
    | Record<string, unknown>;
