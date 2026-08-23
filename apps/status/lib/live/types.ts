export const liveActivityCategories = [
    'garden',
    'care',
    'journey',
    'community',
    'exchange',
    'platform',
    'code',
] as const;

export type LiveActivityCategory = (typeof liveActivityCategories)[number];

export const liveActivitySources = ['gredice', 'vercel', 'github'] as const;

export type LiveActivitySource = (typeof liveActivitySources)[number];

export type LiveActivityEvent = {
    id: string;
    source: LiveActivitySource;
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
    source: 'combined-events' | 'domain-events' | 'unavailable';
    events: LiveActivityEvent[];
    categoryTotals: Record<LiveActivityCategory, number>;
    sourceTotals: Record<LiveActivitySource, number>;
    connectedSources: LiveActivitySource[];
};
