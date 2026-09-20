import type { CalendarActivity } from './calendarActivities';

export const regionalCalendarRegion = 'Kontinentalna Hrvatska';
export const regionalCalendarPilotSlugs = [
    'salata',
    'spinat',
    'matovilac',
    'cesnjak',
    'rajcica',
];

export type RegionalCalendarReview = {
    plantId: number;
    region: typeof regionalCalendarRegion;
    reviewer: { name: string; role: string };
    reviewedAt: string;
    reviewBefore: string;
    /** Digest of the existing directory calendar, never a second set of dates. */
    calendarDigest: string;
    sources: { label: string; url: string }[];
    /** null explicitly means that this activity has no regional recommendation. */
    activities: Record<
        CalendarActivity,
        {
            environment: 'outdoors' | 'protected';
            varietyNotes: string;
            /** Indexes into the reviewed directory activity's ranges. */
            rangeIndexes: number[];
        } | null
    >;
};

// Add only actual grower reviews. See docs/regional-sowing-calendar.md.
// The directory's generic verified flag and updatedAt are not calendar reviews.
export const regionalCalendarReviews: RegionalCalendarReview[] = [];
