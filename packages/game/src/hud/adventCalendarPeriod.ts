const adventCalendarYear = 2025;

export function isAdventCalendarHudPeriod(now: Date) {
    return now.getFullYear() === adventCalendarYear && now.getMonth() === 11;
}
