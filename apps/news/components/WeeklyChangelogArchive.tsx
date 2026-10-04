'use client';

import { useSearchParams } from 'next/navigation';
import type { ChangelogWeek } from '../lib/weeklyChangelog';
import { NewsTagFilters } from './NewsTagFilters';
import { WeeklyChangelogTimeline } from './WeeklyChangelogTimeline';

function normalizedTag(value: string) {
    return value.trim().toLocaleLowerCase('hr-HR');
}

export function WeeklyChangelogArchive({
    dropdownTags,
    primaryTags,
    weeks,
}: {
    dropdownTags: string[];
    primaryTags: string[];
    weeks: ChangelogWeek[];
}) {
    const searchParams = useSearchParams();
    const requestedTag = searchParams.get('tag')?.trim() || undefined;
    const knownTags = [...primaryTags, ...dropdownTags];
    const activeTag = requestedTag
        ? knownTags.find(
              (tag) => normalizedTag(tag) === normalizedTag(requestedTag),
          )
        : undefined;
    const filteredWeeks = activeTag
        ? weeks.filter((week) =>
              week.entries.some((entry) =>
                  entry.tags.some(
                      (tag) => normalizedTag(tag) === normalizedTag(activeTag),
                  ),
              ),
          )
        : requestedTag
          ? []
          : weeks;

    return (
        <div className="grid gap-8">
            {knownTags.length > 0 ? (
                <NewsTagFilters
                    activeTag={activeTag ?? requestedTag}
                    dropdownTags={dropdownTags}
                    primaryTags={primaryTags}
                />
            ) : null}
            <WeeklyChangelogTimeline weeks={filteredWeeks} />
        </div>
    );
}
