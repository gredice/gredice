import {
    getSeasonLengthDays,
    getSeasonStartDate,
    seasonCycle,
    seasonPhaseThresholds,
} from './seasonState';

/** Calendar jumps shared by the debug HUD and deterministic seasonal fixtures. */
export function getSeasonDebugMilestones(year: number) {
    const autumnStart = getSeasonStartDate('autumn', year);
    const autumnDays = getSeasonLengthDays('autumn', year - 1);
    return [
        ...seasonCycle.map((season) => ({
            key: season,
            label: `${season[0].toUpperCase()}${season.slice(1)} start`,
            date: getSeasonStartDate(season, year),
        })),
        ...Object.entries(seasonPhaseThresholds).map(([phase, progress]) => {
            const date = new Date(autumnStart);
            date.setDate(date.getDate() + Math.ceil(autumnDays * progress));
            return {
                key: `${phase}-autumn`,
                label: `${phase[0].toUpperCase()}${phase.slice(1)} autumn`,
                date,
            };
        }),
    ].sort((first, second) => first.date.getTime() - second.date.getTime());
}
