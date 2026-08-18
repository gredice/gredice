import { Timeline, TimelineEntry, TimelineGroup } from '@gredice/ui/Timeline';
import type { ChangelogWeek } from '../lib/weeklyChangelog';
import { EmptyNewsState } from './EmptyNewsState';
import { WeeklyChangelogCard } from './WeeklyChangelogCard';

type ChangelogTimelineGroup = {
    monthKey: string;
    monthLabel: string;
    weeks: ChangelogWeek[];
};

function groupWeeksByMonth(weeks: ChangelogWeek[]) {
    const groups: ChangelogTimelineGroup[] = [];
    const groupsByKey = new Map<string, ChangelogTimelineGroup>();

    for (const week of weeks) {
        let group = groupsByKey.get(week.monthKey);
        if (!group) {
            group = {
                monthKey: week.monthKey,
                monthLabel: week.monthLabel,
                weeks: [],
            };
            groupsByKey.set(week.monthKey, group);
            groups.push(group);
        }
        group.weeks.push(week);
    }

    return groups;
}

export function WeeklyChangelogTimeline({
    emptyDescription = 'Trenutačno nema objavljenih novosti za ovu oznaku.',
    weeks,
}: {
    emptyDescription?: string;
    weeks: ChangelogWeek[];
}) {
    const groups = groupWeeksByMonth(weeks);
    let weekIndex = 0;

    if (weeks.length === 0) {
        return (
            <EmptyNewsState title="Nema tjednih pregleda">
                {emptyDescription}
            </EmptyNewsState>
        );
    }

    return (
        <Timeline>
            {groups.map((group, groupIndex) => (
                <TimelineGroup
                    hasItems={group.weeks.length > 0}
                    isFirst={groupIndex === 0}
                    key={group.monthKey}
                    label={group.monthLabel}
                >
                    {group.weeks.map((week) => {
                        const currentWeekIndex = weekIndex;
                        weekIndex += 1;

                        return (
                            <TimelineEntry
                                index={currentWeekIndex}
                                isLast={currentWeekIndex === weeks.length - 1}
                                key={week.weekKey}
                                label={week.rangeLabel}
                            >
                                <WeeklyChangelogCard week={week} />
                            </TimelineEntry>
                        );
                    })}
                </TimelineGroup>
            ))}
        </Timeline>
    );
}
