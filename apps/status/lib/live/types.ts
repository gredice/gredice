export const liveActivityCategories = [
    'garden',
    'care',
    'journey',
    'community',
    'exchange',
] as const;

export type LiveActivityCategory = (typeof liveActivityCategories)[number];

export type LiveActivityEvent = {
    id: string;
    category: LiveActivityCategory;
    label: string;
    title: string;
    detail: string;
    occurredAt: string;
    lane: number;
    intensity: number;
};

export type LiveActivitySnapshot = {
    capturedAt: string;
    windowStart: string | null;
    windowEnd: string | null;
    source: 'domain-events' | 'unavailable';
    events: LiveActivityEvent[];
    categoryTotals: Record<LiveActivityCategory, number>;
};
