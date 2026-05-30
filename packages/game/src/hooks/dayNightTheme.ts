export function resolveDayNightTheme({
    dayNightCycleDisabled,
    isDaytime,
}: {
    dayNightCycleDisabled: boolean;
    isDaytime: boolean;
}) {
    return dayNightCycleDisabled || isDaytime ? 'light' : 'dark';
}
